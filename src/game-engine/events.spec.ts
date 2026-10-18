import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import { ITEM_CATALOG, itemBonusPercent } from './items';
import { healingMultiplier } from './combat';
import { TUNING } from './constants/tuning';
import {
  applyCritBoostEvent,
  applyDoubleItemEvent,
  applyHealBoostEvent,
  applyHealEvent,
  applyOverdriveEvent,
  applyRerollSkillEvent,
  consumeEventPick,
  eligibleEvents,
  migrateEventState,
  rollEventChoices,
} from './events';
import { effectiveCritChance } from './leveling';
import { createRng } from './rng';
import type { Character, Habit } from './types';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-id',
    name: 'Test Habit',
    period: 'daily',
    difficulty: 'easy',
    damageType: 'physical',
    isBad: false,
    streakCount: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return { ...createCharacter(createRng(1)), ...overrides };
}

const ids = (events: { id: string }[]) => events.map((e) => e.id).sort();

describe('eligibleEvents', () => {
  it('offers only the always-available events at level 1 with no habits and full health', () => {
    expect(ids(eligibleEvents(makeCharacter({ level: 1 }), []))).toEqual(['crit-boost', 'heal-boost', 'item-drop', 'quest']);
  });

  it('offers heal only when below max health', () => {
    const full = makeCharacter();
    expect(ids(eligibleEvents(full, []))).not.toContain('heal');
    const hurt = makeCharacter({ currentHealth: full.currentHealth - 1 });
    expect(ids(eligibleEvents(hurt, []))).toContain('heal');
  });

  it('hides item-drop once every droppable item is owned', () => {
    const everything = ITEM_CATALOG.map((i) => i.id);
    expect(ids(eligibleEvents(makeCharacter({ ownedItemIds: everything }), []))).not.toContain('item-drop');
  });

  it('gates events by level', () => {
    const habits = [makeHabit({ id: 'd' }), makeHabit({ id: 'w', period: 'weekly' })];
    expect(ids(eligibleEvents(makeCharacter({ level: TUNING.SPECIAL_LEVEL }), habits))).toEqual(['crit-boost', 'heal', 'heal-boost', 'item-drop', 'overdrive', 'quest', 'reroll-skill', 'special']);
    expect(ids(eligibleEvents(makeCharacter({ level: TUNING.ULT_LEVEL }), habits))).toContain('ult');
    expect(ids(eligibleEvents(makeCharacter({ level: 6 }), habits))).not.toContain('item-slots');
    expect(ids(eligibleEvents(makeCharacter({ level: 7 }), habits))).toContain('item-slots');
  });

  it('hides one-time events once taken, but keeps repeatable ones', () => {
    const habits = [makeHabit({ id: 'd' })];
    const character = makeCharacter({ level: 7, takenEventIds: ['special', 'item-slots', 'overdrive', 'quest'] });
    const result = ids(eligibleEvents(character, habits));
    expect(result).not.toContain('special');
    expect(result).not.toContain('item-slots');
    expect(result).toContain('overdrive');
    expect(result).toContain('quest');
  });

  it('hides special/ult/overdrive when no matching good habit exists', () => {
    const habits = [makeHabit({ id: 'bad', isBad: true }), makeHabit({ id: 'w', period: 'weekly', isBad: true })];
    const result = ids(eligibleEvents(makeCharacter({ level: 10 }), habits));
    expect(result).not.toContain('special');
    expect(result).not.toContain('ult');
    expect(result).not.toContain('overdrive');
  });
});

describe('rollEventChoices', () => {
  it('returns at most 3 distinct eligible events', () => {
    const habits = [makeHabit({ id: 'd' }), makeHabit({ id: 'w', period: 'weekly' })];
    const character = makeCharacter({ level: 10 });
    for (let seed = 0; seed < 30; seed++) {
      const choices = rollEventChoices(character, habits, createRng(seed));
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((c) => c.id)).size).toBe(3);
    }
  });

  it('respects a smaller count', () => {
    expect(rollEventChoices(makeCharacter({ level: 1 }), [], createRng(1), 2)).toHaveLength(2);
  });
});

describe('consumeEventPick', () => {
  it('spends one pending pick and records one-time events as taken', () => {
    const result = consumeEventPick(makeCharacter({ pendingEventPicks: 2, takenEventIds: [] }), 'special');
    expect(result.pendingEventPicks).toBe(1);
    expect(result.takenEventIds).toEqual(['special']);
  });

  it('does not record repeatable events as taken and never goes below 0', () => {
    const result = consumeEventPick(makeCharacter({ pendingEventPicks: 0, takenEventIds: [] }), 'quest');
    expect(result.pendingEventPicks).toBe(0);
    expect(result.takenEventIds).toEqual([]);
  });
});

describe('applyOverdriveEvent', () => {
  it('always grants Overdrive to a good habit', () => {
    const { habits, granted } = applyOverdriveEvent([makeHabit({ id: 'a' }), makeHabit({ id: 'b', isBad: true })], createRng(5));
    expect(granted?.id).toBe('a');
    expect(habits.find((h) => h.id === 'a')?.isOverdrive).toBe(true);
  });
});

describe('boost events', () => {
  it('crit boost adds a timed crit bonus and refreshes rather than stacks', () => {
    const base = makeCharacter();
    const once = applyCritBoostEvent(base, '2026-10-17');
    const twice = applyCritBoostEvent(once, '2026-10-18');
    expect(twice.statusEffects?.filter((e) => e.type === 'critBoost')).toHaveLength(1);
    expect(effectiveCritChance(once, '2026-10-17') - effectiveCritChance(base, '2026-10-17')).toBeCloseTo(TUNING.CRIT_BOOST_BONUS, 10);
    expect(effectiveCritChance(once, '2026-10-19')).toBeGreaterThan(effectiveCritChance(base, '2026-10-19')); // day 3 still active
    expect(effectiveCritChance(once, '2026-10-20')).toBe(effectiveCritChance(base, '2026-10-20')); // expired
    expect(effectiveCritChance(once)).toBe(effectiveCritChance(base)); // no day key, no boost
  });

  it('heal boost multiplies healing by 1 + bonus for 3 days, stacking with Wounds', () => {
    const boosted = applyHealBoostEvent(makeCharacter(), '2026-10-17');
    expect(healingMultiplier(boosted, '2026-10-17')).toBeCloseTo(1 + TUNING.HEAL_BOOST_BONUS, 10);
    expect(healingMultiplier(boosted, '2026-10-19')).toBeCloseTo(1 + TUNING.HEAL_BOOST_BONUS, 10);
    expect(healingMultiplier(boosted, '2026-10-20')).toBe(1);
    const wounded: Character = {
      ...boosted,
      statusEffects: [...(boosted.statusEffects ?? []), { type: 'wounds', appliedDayKey: '2026-10-17', durationDays: 3, effectRate: 0.5 }],
    };
    expect(healingMultiplier(wounded, '2026-10-17')).toBeCloseTo(0.5 * (1 + TUNING.HEAL_BOOST_BONUS), 10);
  });
});

describe('double-item event', () => {
  const equipped = { equippedItemIds: ['rusty-blade', 'steel-sword'], ownedItemIds: ['rusty-blade', 'steel-sword'] };

  it('is offered from level 10 when items are equipped and none is doubled', () => {
    expect(ids(eligibleEvents(makeCharacter({ level: 10, ...equipped }), []))).toContain('double-item');
    expect(ids(eligibleEvents(makeCharacter({ level: 9, ...equipped }), []))).not.toContain('double-item');
    expect(ids(eligibleEvents(makeCharacter({ level: 10 }), []))).not.toContain('double-item'); // nothing equipped
  });

  it('is not offered while a doubled item is still equipped, and is offered again once it is gone', () => {
    const doubled = makeCharacter({ level: 10, ...equipped, doubledItemId: 'rusty-blade' });
    expect(ids(eligibleEvents(doubled, []))).not.toContain('double-item');
    const gone = makeCharacter({ level: 10, equippedItemIds: ['steel-sword'], ownedItemIds: ['steel-sword'], doubledItemId: undefined });
    expect(ids(eligibleEvents(gone, []))).toContain('double-item');
  });

  it('is not offered when only a consumable is equipped', () => {
    const feather = ITEM_CATALOG.find((i) => i.type === 'consumable');
    if (!feather) throw new Error('missing fixture item');
    const character = makeCharacter({ level: 10, equippedItemIds: [feather.id], ownedItemIds: [feather.id] });
    expect(ids(eligibleEvents(character, []))).not.toContain('double-item');
  });

  it('doubles one equipped item\'s bonuses and no other', () => {
    const base = makeCharacter({ level: 10, equippedItemIds: ['rusty-blade'], ownedItemIds: ['rusty-blade'] });
    const before = itemBonusPercent(base, 'physicalDamage');
    const { character, item } = applyDoubleItemEvent(base, createRng(1));
    expect(item?.id).toBe('rusty-blade');
    expect(character.doubledItemId).toBe('rusty-blade');
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(before * TUNING.DOUBLED_ITEM_MULTIPLIER);
  });
});

describe('applyHealEvent', () => {
  it('heals EVENT_HEAL_PCT% of max health and reports the amount', () => {
    const base = makeCharacter();
    const max = base.currentHealth;
    const { character, healed } = applyHealEvent({ ...base, currentHealth: 0 });
    expect(character.currentHealth).toBeCloseTo(max * (TUNING.EVENT_HEAL_PCT / 100), 5);
    expect(healed).toBeCloseTo(character.currentHealth, 5);
  });

  it('never exceeds max health', () => {
    const base = makeCharacter();
    const { character, healed } = applyHealEvent({ ...base, currentHealth: base.currentHealth - 1 });
    expect(character.currentHealth).toBe(base.currentHealth);
    expect(healed).toBeCloseTo(1, 5);
  });
});

describe('applyRerollSkillEvent', () => {
  it('never keeps the same damage type, and only touches the chosen habit', () => {
    for (let seed = 0; seed < 200; seed++) {
      const habits = [makeHabit({ id: 'a', damageType: 'physical' }), makeHabit({ id: 'b', damageType: 'magic' })];
      const result = applyRerollSkillEvent(habits, 'a', createRng(seed));
      expect(result.find((h) => h.id === 'a')?.damageType).not.toBe('physical');
      expect(result.find((h) => h.id === 'b')?.damageType).toBe('magic');
    }
  });
});

describe('migrateEventState', () => {
  it('marks what the old automatic rules already granted as taken', () => {
    const habits = [makeHabit({ id: 'a', isSpecial: true }), makeHabit({ id: 'b', period: 'weekly', isUlt: true })];
    const legacy = makeCharacter({ level: 10, takenEventIds: undefined, pendingEventPicks: undefined });
    const result = migrateEventState(legacy, habits);
    expect(result.takenEventIds?.sort()).toEqual(['item-slots', 'special', 'ult']);
    expect(result.pendingEventPicks).toBe(0);
  });

  it('does not grant item-slots below level 10 and leaves already-migrated characters alone', () => {
    const legacy = makeCharacter({ level: 9, takenEventIds: undefined });
    expect(migrateEventState(legacy, []).takenEventIds).toEqual([]);
    const migrated = makeCharacter({ takenEventIds: ['quest'] });
    expect(migrateEventState(migrated, [])).toBe(migrated);
  });
});
