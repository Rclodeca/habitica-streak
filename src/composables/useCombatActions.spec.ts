// @vitest-environment jsdom
//
// This composable reads/writes Pinia store state, which is fine under the
// project's default `node` test environment — but we still want a DOM
// present in case any transitive dependency expects one, matching the
// convention used by `store/index.spec.ts` and `useDailyRollover.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { availableRelics, createRng, dailyPeriodKey, dayOfWeekIndex, effectiveStat, expToNextLevel, heroClassFor, periodKeyFor, PERSONALITY_NAME, questSlotExp, weeklyPeriodKey } from '../game-engine';
import { TUNING } from '../game-engine/constants/tuning';
import { useActivityLogStore } from '../store/activityLogStore';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useDebugClockStore } from '../store/debugClockStore';
import { useHabitStore } from '../store/habitStore';
import { useHighScoreStore } from '../store/highScoreStore';
import { useQuestStore } from '../store/questStore';
import { useBossSkillCard } from './useBossSkillCard';
import { useCelebration } from './useCelebration';
import { useCombatActions } from './useCombatActions';
import { useDeathScreen } from './useDeathScreen';
import { useFallenHero } from './useFallenHero';
import { setHitPlayer } from './useHitFeed';
import type { Habit } from '../game-engine';
import type { Hit } from './useHitFeed';
import { useItemDropQueue } from './useItemDropQueue';
import { useReviveNotice } from './useReviveNotice';

describe('useCombatActions', () => {
  beforeEach(() => {
    localStorage.clear(); // highScoreStore persists outside Pinia's own state
    setActivePinia(createPinia());
  });

  // `isDead`/revive-notice `visible` are module-scope singletons (see
  // useDeathScreen.ts/useReviveNotice.ts) — dismiss/clear them after every
  // test so state triggered in one test can't leak into the next.
  afterEach(() => {
    useDeathScreen().dismiss();
    useReviveNotice().visible.value = false;
    useCelebration().clear();
    useBossSkillCard().clear();
    setHitPlayer(null);
  });

  describe('hits sent to the stage', () => {
    let hits: Hit[];
    beforeEach(() => {
      hits = [];
      setHitPlayer((hit) => {
        hits.push(hit);
        return 480;
      });
    });

    it("sends the hero's blow with its type, the boss's HP change, and what was reflected", () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const characterStore = useCharacterStore();
      const { checkOffHabit } = useCombatActions();
      const habit = habitStore.addHabit('Read', 'daily', 'medium', false, createRng());
      habitStore.updateHabit({ ...habit, damageType: 'magic' });
      bossStore.setBoss({ ...bossStore.boss, health: 100000, maxHealth: 100000, reflectDayKey: dailyPeriodKey(useDebugClockStore().now()) });
      const bossBefore = bossStore.boss;
      const heroBefore = characterStore.character.currentHealth;

      checkOffHabit(habit.id);

      expect(hits).toHaveLength(1);
      const [hit] = hits;
      expect(hit).toMatchObject({ kind: 'strike', by: 'hero', type: 'magic', bossIndex: bossBefore.index, hp: bossStore.boss.health - bossBefore.health });
      if (hit.kind !== 'strike') throw new Error('not a strike');
      expect(hit.amount).toBeGreaterThan(0);
      expect(hit.reflect?.amount).toBeCloseTo((hit.amount * TUNING.BOSS_SKILLS.REFLECT_PCT) / 100);
      expect(hit.reflect?.hp).toBeCloseTo(characterStore.character.currentHealth - heroBefore);
      expect(hit.lifesteal).toBeUndefined();
    });

    it('splits the hero HP change into what was reflected and what was stolen', () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const characterStore = useCharacterStore();
      const { checkOffHabit } = useCombatActions();
      const habit = habitStore.addHabit('Run', 'daily', 'medium', false, createRng());
      habitStore.updateHabit({ ...habit, damageType: 'physical' });
      // Too sturdy to fall, so no kill's heal muddies the hit's own change.
      bossStore.setBoss({ ...bossStore.boss, health: 100000, maxHealth: 100000, reflectDayKey: dailyPeriodKey(useDebugClockStore().now()) });
      characterStore.setCharacter({ ...characterStore.character, currentHealth: 500, ownedItemIds: ['vampiric-fang'], equippedItemIds: ['vampiric-fang'] });

      checkOffHabit(habit.id);

      const [hit] = hits;
      if (hit.kind !== 'strike') throw new Error('not a strike');
      expect(hit.lifesteal?.amount).toBeCloseTo(hit.amount * 0.03);
      expect(hit.reflect!.hp + hit.lifesteal!.hp).toBeCloseTo(characterStore.character.currentHealth - 500);
    });

    it("sends the boss's blow on a bad habit, and the life it steals", () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const characterStore = useCharacterStore();
      const { checkOffHabit } = useCombatActions();
      const habit = habitStore.addHabit('Doomscroll', 'daily', 'medium', true, createRng());
      bossStore.setBoss({ ...bossStore.boss, health: 100, lifestealPct: 0.15 });
      const heroBefore = characterStore.character.currentHealth;

      checkOffHabit(habit.id);

      const dealt = heroBefore - characterStore.character.currentHealth;
      expect(hits).toEqual([
        expect.objectContaining({ kind: 'strike', by: 'boss', amount: dealt, hp: -dealt, lifesteal: { amount: bossStore.boss.health - 100, hp: bossStore.boss.health - 100 } }),
      ]);
    });

    it('sends a heal, then the true damage Censer of Wrath adds to it', () => {
      const habitStore = useHabitStore();
      const characterStore = useCharacterStore();
      const { checkOffHabit } = useCombatActions();
      const habit = { ...habitStore.addHabit('Stretch', 'daily', 'medium', false, createRng()), damageType: 'healing' as const };
      habitStore.updateHabit(habit);
      characterStore.setCharacter({ ...characterStore.character, currentHealth: 100, ownedItemIds: ['censer-of-wrath'], equippedItemIds: ['censer-of-wrath'] });

      checkOffHabit(habit.id);

      expect(hits.map((h) => h.kind)).toEqual(['heal', 'strike']);
      expect(hits[0]).toMatchObject({ amount: characterStore.character.currentHealth - 100, hp: characterStore.character.currentHealth - 100 });
      expect(hits[1]).toMatchObject({ by: 'hero', type: 'trueDamage', crit: false });
    });

    it('sends a Rend as its own hurt after the blow, and logs it under the skill', () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const characterStore = useCharacterStore();
      const { checkOffHabit } = useCombatActions();
      const habit = habitStore.addHabit('Lift', 'daily', 'medium', false, createRng());
      habitStore.updateHabit({ ...habit, damageType: 'physical' });
      // Just above the 50% line, so any blow crosses it without killing.
      bossStore.setBoss({ ...bossStore.boss, health: 50001, maxHealth: 100000, skills: [{ at: 0.5, skill: 'rend' }] });
      characterStore.setCharacter({ ...characterStore.character, currentHealth: 500, ownedItemIds: ['vampiric-fang'], equippedItemIds: ['vampiric-fang'] });

      checkOffHabit(habit.id);

      expect(hits.map((h) => h.kind)).toEqual(['strike', 'hurt']);
      const [strike, hurt] = hits;
      if (strike.kind !== 'strike' || hurt.kind !== 'hurt') throw new Error('wrong hits');
      // The blow's lifesteal is all of the blow's HP change; Rend shows on its own.
      expect(strike.lifesteal?.hp).toBeCloseTo(strike.lifesteal!.amount);
      expect(hurt.hp).toBeCloseTo(-hurt.amount);
      expect(characterStore.character.currentHealth).toBeCloseTo(500 + strike.lifesteal!.amount - hurt.amount);
      const entries = useActivityLogStore().entries;
      // Lifesteal rides on the blow's own entry, not a row of its own.
      expect(entries[0]).toMatchObject({ kind: 'skill-damage' });
      expect((entries[0] as { lifesteal: number }).lifesteal).toBeCloseTo(strike.lifesteal!.amount);
      expect(entries.some((e) => e.kind === 'lifesteal')).toBe(false);
      expect(entries[1]).toMatchObject({ kind: 'boss-skill', skill: 'rend', outcome: 'landed' });
      expect((entries[1] as { amount: number }).amount).toBeCloseTo(hurt.amount);
    });

    it('logs which stat an Empower doubled, and the boss keeps it', () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const { checkOffHabit } = useCombatActions();
      const habit = habitStore.addHabit('Lift', 'daily', 'medium', false, createRng());
      habitStore.updateHabit({ ...habit, damageType: 'physical' });
      bossStore.setBoss({ ...bossStore.boss, health: 50001, maxHealth: 100000, skills: [{ at: 0.5, skill: 'empower' }] });
      const before = { ...bossStore.boss };

      checkOffHabit(habit.id);

      const entry = useActivityLogStore().entries.find((e) => e.kind === 'boss-skill');
      if (entry?.kind !== 'boss-skill' || !entry.stat) throw new Error('no Empower entry with a stat');
      expect(entry).toMatchObject({ skill: 'empower', outcome: 'landed' });
      expect(bossStore.boss[entry.stat]).toBe(before[entry.stat] * 2);
    });

    it("opens a fired skill's card once the blow that set it off lands", () => {
      vi.useFakeTimers();
      try {
        const habitStore = useHabitStore();
        const bossStore = useBossStore();
        const { checkOffHabit } = useCombatActions();
        const habit = habitStore.addHabit('Lift', 'daily', 'medium', false, createRng());
        habitStore.updateHabit({ ...habit, damageType: 'physical' });
        bossStore.setBoss({ ...bossStore.boss, health: 50001, maxHealth: 100000, skills: [{ at: 0.5, skill: 'blind' }] });

        checkOffHabit(habit.id);

        const { current } = useBossSkillCard();
        vi.advanceTimersByTime(479);
        expect(current.value).toBeNull();
        vi.advanceTimersByTime(1);
        expect(current.value).toMatchObject({ skill: 'blind', outcome: 'landed' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('logs a Wounds skill as the familiar Wounds entry', () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const { checkOffHabit } = useCombatActions();
      const habit = habitStore.addHabit('Lift', 'daily', 'medium', false, createRng());
      habitStore.updateHabit({ ...habit, damageType: 'physical' });
      bossStore.setBoss({ ...bossStore.boss, health: 50001, maxHealth: 100000, skills: [{ at: 0.5, skill: 'wounds' }] });

      checkOffHabit(habit.id);

      expect(useActivityLogStore().entries[1]).toMatchObject({ kind: 'wounds-applied', durationDays: 2, effectRate: 0.5 });
    });

    it('sends a missed quest as a plain hurt', () => {
      const characterStore = useCharacterStore();
      const questStore = useQuestStore();
      const { failQuest } = useCombatActions();
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-02-01');
      const heroBefore = characterStore.character.currentHealth;

      failQuest(quest.id);

      const lost = heroBefore - characterStore.character.currentHealth;
      expect(hits).toEqual([{ kind: 'hurt', amount: lost, hp: -lost }]);
    });

    it('lets the killing blow land before the boss falls', () => {
      vi.useFakeTimers();
      try {
        const habitStore = useHabitStore();
        const bossStore = useBossStore();
        const { checkOffHabit } = useCombatActions();
        const habit = habitStore.addHabit('Slay the boss', 'daily', 'hard', false, createRng());
        habitStore.updateHabit({ ...habit, damageType: 'physical' });
        bossStore.setBoss({ ...bossStore.boss, health: 0.0001, armor: 0 });

        checkOffHabit(habit.id);

        const { phase } = useCelebration();
        vi.advanceTimersByTime(479);
        expect(phase.value).toBe('struck');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('checkOffHabit is a no-op when called a second time on a habit already completed this period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());

    // First call: applies combat effects and stamps the habit as completed
    // for the current period.
    checkOffHabit(habit.id);

    const habitAfterFirstCall = habitStore.habits.find((h) => h.id === habit.id);
    const currentPeriodKey = periodKeyFor(habit.period, new Date());
    expect(habitAfterFirstCall?.lastCompletedPeriodKey).toBe(currentPeriodKey);

    const characterSnapshot = { ...characterStore.character };
    const bossSnapshot = { ...bossStore.boss };
    const habitSnapshot = { ...habitAfterFirstCall };

    // Second call on the same, already-completed habit — engine-level guard
    // should return early with no further state changes (no double streak
    // increment, no double boss damage, no double milestone EXP), even
    // though nothing here relies on the UI's `:disabled` binding.
    checkOffHabit(habit.id);

    const habitAfterSecondCall = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character).toEqual(characterSnapshot);
    expect(bossStore.boss).toEqual(bossSnapshot);
    expect(habitAfterSecondCall).toEqual(habitSnapshot);
  });

  it('a heal with Censer of Wrath also logs the damage it dealt to the boss', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const activityLogStore = useActivityLogStore();
    const { checkOffHabit } = useCombatActions();

    const habit = { ...habitStore.addHabit('Stretch', 'daily', 'medium', false, createRng()), damageType: 'healing' as const };
    habitStore.updateHabit(habit);
    characterStore.setCharacter({ ...characterStore.character, ownedItemIds: ['censer-of-wrath'], equippedItemIds: ['censer-of-wrath'] });
    const bossHealthBefore = bossStore.boss.health;

    checkOffHabit(habit.id);

    expect(bossStore.boss.health).toBeLessThan(bossHealthBefore);
    expect(activityLogStore.entries.map((e) => e.kind)).toEqual(expect.arrayContaining(['heal', 'skill-damage']));
    expect(activityLogStore.entries.find((e) => e.kind === 'skill-damage')).toMatchObject({ isTrueDamage: true });
  });

  it('checkOffHabit returns the items dropped when completing a habit defeats the boss', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Slay the boss', 'daily', 'hard', false, createRng());
    habitStore.updateHabit({ ...habit, damageType: 'physical' }); // deterministic damage type
    bossStore.setBoss({ ...bossStore.boss, health: 0.0001, armor: 0 }); // one hit from defeat

    const result = checkOffHabit(habit.id);

    expect(result.itemsDropped.length).toBeGreaterThan(0);
  });

  it('a boss kill keeps the slain boss on screen for its death, names it on the drops, and holds the old level', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    const characterStore = useCharacterStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Slay the boss', 'daily', 'hard', false, createRng());
    habitStore.updateHabit({ ...habit, damageType: 'physical' });
    bossStore.setBoss({ ...bossStore.boss, health: 0.0001, armor: 0 });
    const slain = bossStore.boss;
    const levelBefore = characterStore.character.level;
    characterStore.setCharacter({ ...characterStore.character, exp: expToNextLevel(levelBefore) - 1 }); // the kill's EXP levels up

    const result = checkOffHabit(habit.id);

    const { displayedBoss, heldLevel } = useCelebration();
    expect(bossStore.boss.index).toBe(slain.index + 1);
    expect(displayedBoss.value).toMatchObject({ index: slain.index, health: 0 });
    expect(result.droppedBy).toBe(PERSONALITY_NAME[slain.personality]);
    expect(characterStore.character.level).toBeGreaterThan(levelBefore);
    expect(heldLevel.value).toBe(levelBefore);
  });

  it('checkOffHabit returns no items dropped when the habit completion does not defeat the boss', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Meditate', 'daily', 'easy', false, createRng());
    // Comfortably above anything a single easy habit could deal, regardless
    // of the character's randomized physical/magic split (see
    // TUNING.DAMAGE_SPLIT_RATIOS) — this test only cares about the
    // no-defeat path, not damage magnitude.
    bossStore.setBoss({ ...bossStore.boss, health: 1_000_000 });

    const result = checkOffHabit(habit.id);

    expect(result.itemsDropped).toEqual([]);
  });

  it('checkMissedHabit flags the death screen instead of resetting immediately when it brings currentHealth to 0', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    characterStore.character = { ...characterStore.character, currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3 });

    checkMissedHabit(habit.id);

    expect(isDead.value).toBe(true);
    // No auto-reset yet — character/boss are left exactly as the miss left them.
    expect(characterStore.character.currentHealth).toBe(0);
    expect(bossStore.boss.index).toBe(3);
  });

  it('flags the death screen when currentHealth is a tiny positive fraction that rounds to 0 (not literally 0)', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    // Health bar already displays Math.round(currentHealth), so 0.3 reads
    // as "0 HP" even though it's not literally 0. Zero boss attack means
    // this miss deals 0 damage regardless of the crit/attack-type rng roll,
    // so currentHealth stays at exactly 0.3 — deterministic, no flakiness.
    characterStore.character = { ...characterStore.character, currentHealth: 0.3 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 0, magicAttack: 0, index: 3 });

    checkMissedHabit(habit.id);

    expect(characterStore.character.currentHealth).toBe(0.3);
    expect(isDead.value).toBe(true);
  });

  it('checkMissedHabit revives via an equipped Phoenix Feather instead of triggering the death screen', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit } = useCombatActions();
    const { isDead } = useDeathScreen();
    const { visible: reviveVisible } = useReviveNotice();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    characterStore.character = {
      ...characterStore.character,
      currentHealth: 1,
      ownedItemIds: ['phoenix-feather'],
      equippedItemIds: ['phoenix-feather'],
    };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3 });

    checkMissedHabit(habit.id);

    expect(isDead.value).toBe(false);
    expect(reviveVisible.value).toBe(true);
    expect(characterStore.character.currentHealth).toBeCloseTo(effectiveStat(characterStore.character, 'health') * 0.5, 5);
    expect(characterStore.character.equippedItemIds).not.toContain('phoenix-feather');
    expect(characterStore.character.ownedItemIds).not.toContain('phoenix-feather');
    expect(bossStore.boss.index).toBe(3); // boss progress untouched by a feather revive
  });

  it('restart resets character/boss/habits and clears the death flag', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit, restart } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    characterStore.character = { ...characterStore.character, currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3 });
    checkMissedHabit(habit.id);
    expect(isDead.value).toBe(true);

    restart();

    expect(isDead.value).toBe(false);
    expect(characterStore.character.level).toBe(1);
    expect(characterStore.character.exp).toBe(0);
    expect(characterStore.character.currentHealth).toBe(characterStore.character.starterStats.health);
    expect(bossStore.boss.index).toBe(1);
    expect(habitStore.habits).toHaveLength(1); // habit definitions kept, not wiped
  });

  it('restart keeps in-progress quests and clears event state', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const questStore = useQuestStore();
    const { checkMissedHabit, restart } = useCombatActions();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    questStore.addQuest('Clean garage', 'medium', '2099-01-01');
    characterStore.character = { ...characterStore.character, currentHealth: 1, takenEventIds: ['special'], pendingEventPicks: 2 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3 });
    checkMissedHabit(habit.id);

    restart();

    expect(questStore.quests).toHaveLength(1);
    expect(questStore.quests[0].description).toBe('Clean garage');
    expect(characterStore.character.takenEventIds).toEqual([]);
    expect(characterStore.character.pendingEventPicks).toBe(0);
  });

  it('a level-up queues one pending event pick per level gained', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest } = useCombatActions();

    const quest = questStore.addQuest('Clean garage', 'hard', '2099-01-01');
    characterStore.character = { ...characterStore.character, exp: expToNextLevel(1) - 1, pendingEventPicks: 0 };

    completeQuest(quest.id);

    expect(characterStore.character.level).toBeGreaterThan(1);
    expect(characterStore.character.pendingEventPicks).toBe(characterStore.character.level - 1);
  });

  it('restart remembers who fell and where, and the new hero starts unnamed', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit, restart } = useCombatActions();
    const { fallen, clearFallen } = useFallenHero();
    clearFallen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    characterStore.character = { ...characterStore.character, name: 'Aria', currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 7 });
    checkMissedHabit(habit.id);

    restart();

    expect(fallen.value).toEqual({ name: 'Aria', bossIndex: 7 });
    expect(characterStore.character.name).toBeUndefined();
    clearFallen();
  });

  it('restart opens quests for the new run only when quests carried over', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const questStore = useQuestStore();
    const { checkMissedHabit, restart } = useCombatActions();
    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());

    const dieAndRestart = () => {
      characterStore.character = { ...characterStore.character, currentHealth: 1 };
      bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000 });
      checkMissedHabit(habit.id);
      restart();
    };

    dieAndRestart();
    expect(characterStore.character.questsUnlocked).toBe(false);

    questStore.addQuest('Clean the garage', 'hard', '2099-01-01');
    dieAndRestart();
    expect(characterStore.character.questsUnlocked).toBe(true);
    useFallenHero().clearFallen();
  });

  it('restart records the just-ended run into the high-score leaderboard before resetting', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const highScoreStore = useHighScoreStore();
    const { checkMissedHabit, restart } = useCombatActions();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    characterStore.character = { ...characterStore.character, currentHealth: 1, level: 4, name: 'Aldric' };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3, personality: 'brute4x' });
    checkMissedHabit(habit.id);
    const characterAtDeath = characterStore.character;
    const habitAtDeath = habitStore.habits.find((h) => h.id === habit.id)!;

    restart();

    expect(highScoreStore.topRuns).toHaveLength(1);
    const run = highScoreStore.topRuns[0];
    expect(run.bossIndex).toBe(3); // the boss being fought at death, not the post-reset index 1
    expect(run.level).toBe(4);
    expect(run.habits).toEqual([
      {
        name: 'Exercise',
        period: 'daily',
        damageType: habitAtDeath.damageType,
        isBad: false,
        streakCount: habitAtDeath.streakCount,
        rank: habitAtDeath.rank ?? 0,
      },
    ]);
    expect(run.items).toEqual([]); // no items dropped in this test
    expect(run.stats.health).toBeGreaterThan(0);
    expect(run.heroName).toBe('Aldric');
    expect(run.heroClass).toBe(heroClassFor(characterAtDeath));
    expect(run.bossPersonality).toBe('brute4x'); // the boss that ended the run
  });

  it('checkOffHabit on a bad habit damages the player (penalty), resets its streak, and stamps completed', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());
    habitStore.updateHabit({ ...habit, streakCount: 4 });
    const healthBefore = characterStore.character.currentHealth;
    const bossHealthBefore = bossStore.boss.health;

    const result = checkOffHabit(habit.id);

    const currentPeriodKey = periodKeyFor(habit.period, new Date());
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(bossStore.boss.health).toBe(bossHealthBefore); // tapping a bad habit never damages the boss
    expect(updatedHabit?.streakCount).toBe(0); // doing the bad thing resets the avoidance streak
    expect(updatedHabit?.lastCompletedPeriodKey).toBe(currentPeriodKey);
    expect(result.itemsDropped).toEqual([]);
  });

  it('checkOffHabit is a no-op the second time on a bad habit already resolved this period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());
    checkOffHabit(habit.id);
    const healthAfterFirstCall = characterStore.character.currentHealth;

    checkOffHabit(habit.id);

    expect(characterStore.character.currentHealth).toBe(healthAfterFirstCall);
  });

  it('checkOffHabit on a bad habit can flag the death screen, same as a good habit miss', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'hard', true, createRng());
    characterStore.character = { ...characterStore.character, currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000 });

    checkOffHabit(habit.id);

    expect(isDead.value).toBe(true);
  });

  it('checkAvoidedHabit rewards the player by damaging the boss and increments the avoidance streak', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    const { checkAvoidedHabit } = useCombatActions();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());
    habitStore.updateHabit({ ...habit, damageType: 'physical' }); // deterministic damage type
    // High enough that this single hit can't defeat/respawn the boss — this
    // test is about the damage-dealt/streak assertions below, not defeat.
    bossStore.setBoss({ ...bossStore.boss, health: 1_000_000, maxHealth: 1_000_000 });
    const bossHealthBefore = bossStore.boss.health;

    const result = checkAvoidedHabit(habit.id);

    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);
    expect(bossStore.boss.health).toBeLessThan(bossHealthBefore);
    expect(updatedHabit?.streakCount).toBe(1);
    expect(updatedHabit?.lastCompletedPeriodKey).toBeNull(); // a rollover resolution is never an active tap
    expect(result.itemsDropped).toEqual([]);
  });

  it('completeQuest grants the slot-1 weekly-curve EXP, logs quest-completed, and removes the quest', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest } = useCombatActions();
    const activityLogStore = useActivityLogStore();

    const quest = questStore.addQuest('Clean garage', 'medium', '2026-02-01');
    const { exp, level } = characterStore.character;

    const result = completeQuest(quest.id);

    const expected = questSlotExp(level, 'medium', 0);
    expect(expected).toBeLessThan(expToNextLevel(level)); // well under one level at level 1
    expect(result).toEqual({ amount: expected, item: null });
    expect(characterStore.character.exp).toBeCloseTo(exp + expected, 10);
    expect(questStore.quests).toEqual([]);
    expect(activityLogStore.entries[0]).toMatchObject({ kind: 'quest-completed', description: 'Clean garage', amount: expected });
  });

  it('each further regular completion in the same calendar week takes the next slot', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest } = useCombatActions();
    // Level 20 keeps three quests' worth of EXP from levelling the character mid-test.
    characterStore.character = { ...characterStore.character, level: 20, exp: 0 };

    characterStore.character = { ...characterStore.character, questWeek: { weekKey: weeklyPeriodKey(useDebugClockStore().now()), completed: 4 } };

    const amounts = [1, 2, 3].map((n) => completeQuest(questStore.addQuest(`Quest ${n}`, 'medium', '2099-01-01').id)?.amount);

    expect(amounts).toEqual([questSlotExp(20, 'medium', 4), questSlotExp(20, 'medium', 5), questSlotExp(20, 'medium', 6)]);
    expect(amounts[0]!).toBeGreaterThan(amounts[1]!);
    expect(amounts[1]!).toBeGreaterThan(amounts[2]!);
    expect(characterStore.character.questWeek).toEqual({ weekKey: weeklyPeriodKey(useDebugClockStore().now()), completed: 7 });
  });

  it('slot 12 and beyond pays nothing but still completes and clears the quest', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest } = useCombatActions();
    characterStore.character = { ...characterStore.character, level: 20, questWeek: { weekKey: weeklyPeriodKey(useDebugClockStore().now()), completed: 11 } };
    const expBefore = characterStore.character.exp;

    const result = completeQuest(questStore.addQuest('Late one', 'hard', '2099-01-01').id);

    expect(result?.amount).toBe(0);
    expect(characterStore.character.exp).toBe(expBefore);
    expect(questStore.quests).toEqual([]);
  });

  it('a new calendar week starts back at slot 1', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const clock = useDebugClockStore();
    const { completeQuest } = useCombatActions();
    characterStore.character = { ...characterStore.character, level: 20, exp: 0 };

    completeQuest(questStore.addQuest('This week', 'medium', '2099-01-01').id);
    clock.offsetMs += 7 * 24 * 60 * 60 * 1000;
    const next = completeQuest(questStore.addQuest('Next week', 'medium', '2099-01-01').id);

    expect(next?.amount).toBe(questSlotExp(20, 'medium', 0));
    expect(characterStore.character.questWeek).toEqual({ weekKey: weeklyPeriodKey(clock.now()), completed: 1 });
  });

  it('a failed quest does not consume a slot', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest, failQuest } = useCombatActions();
    characterStore.character = { ...characterStore.character, level: 20, exp: 0 };

    failQuest(questStore.addQuest('Missed', 'easy', '2026-02-01').id);
    expect(characterStore.character.questWeek).toBeUndefined();
    const result = completeQuest(questStore.addQuest('Done', 'medium', '2099-01-01').id);

    expect(result?.amount).toBe(questSlotExp(20, 'medium', 0));
  });

  it('completing a side quest grants its item and no EXP, and leaves the weekly count alone', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const activityLogStore = useActivityLogStore();
    const { completeQuest } = useCombatActions();
    const { current, dismiss } = useItemDropQueue();

    const itemId = 'ember-heart';
    const quest = questStore.addQuest('Slay it', 'hard', '2099-01-01', 'side', itemId);
    const { exp, questWeek } = characterStore.character;

    const result = completeQuest(quest.id);

    expect(result?.amount).toBe(0);
    expect(result?.item?.id).toBe(itemId);
    expect(characterStore.character.exp).toBe(exp);
    expect(characterStore.character.questWeek).toBe(questWeek);
    expect(characterStore.character.ownedItemIds).toContain(itemId);
    expect(current.value?.id).toBe(itemId); // goes through the item-drop popup path
    expect(questStore.quests).toEqual([]);
    expect(activityLogStore.entries[0]).toMatchObject({ kind: 'quest-completed', amount: 0, itemName: result?.item?.name });
    expect(characterStore.character.earnedRelicIds).toEqual([itemId]);
    dismiss();
  });

  it('a side quest from before relics still pays the item it promised', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest } = useCombatActions();
    const { dismiss } = useItemDropQueue();

    const quest = questStore.addQuest('Old oath', 'easy', '2099-01-01', 'side', 'godslayer-greatblade');
    const result = completeQuest(quest.id);

    expect(result?.item?.id).toBe('godslayer-greatblade');
    expect(characterStore.character.ownedItemIds).toContain('godslayer-greatblade');
    expect(characterStore.character.earnedRelicIds ?? []).toEqual([]);
    dismiss();
  });

  it('a pre-relic side quest whose promised item already dropped pays an available relic instead', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { completeQuest } = useCombatActions();
    const { dismiss } = useItemDropQueue();
    characterStore.setCharacter({ ...characterStore.character, ownedItemIds: ['godslayer-greatblade'], equippedItemIds: ['godslayer-greatblade'] });

    const quest = questStore.addQuest('Old oath', 'easy', '2099-01-01', 'side', 'godslayer-greatblade');
    const result = completeQuest(quest.id);

    expect(result?.item?.rarity).toBe('relic');
    expect(characterStore.character.ownedItemIds).toContain(result?.item?.id);
    expect(characterStore.character.earnedRelicIds).toEqual([result?.item?.id]);
    dismiss();
  });

  it('a missed side quest returns its relic to the pool', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { failQuest } = useCombatActions();

    const itemId = 'ember-heart';
    const quest = questStore.addQuest('Slay it', 'easy', '2026-02-01', 'side', itemId);
    expect(availableRelics(characterStore.character, questStore.quests).map((i) => i.id)).not.toContain(itemId);

    failQuest(quest.id);

    expect(characterStore.character.ownedItemIds).not.toContain(itemId);
    expect(availableRelics(characterStore.character, questStore.quests).map((i) => i.id)).toContain(itemId);
  });

  it('completeQuest is a no-op for an id that is not in the quest store', () => {
    const characterStore = useCharacterStore();
    const { completeQuest } = useCombatActions();
    const expBefore = characterStore.character.exp;

    completeQuest('does-not-exist');

    expect(characterStore.character.exp).toBe(expBefore);
  });

  it('failQuest damages the character via questMissDamage, logs quest-failed, and removes the quest', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    const { failQuest } = useCombatActions();
    const activityLogStore = useActivityLogStore();

    const quest = questStore.addQuest('Clean garage', 'medium', '2026-02-01');
    const healthBefore = characterStore.character.currentHealth;

    failQuest(quest.id);

    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(questStore.quests).toEqual([]);
    expect(activityLogStore.entries[0]).toMatchObject({ kind: 'quest-failed', description: 'Clean garage' });
  });

  it('failQuest flags the death screen instead of resetting immediately when it brings currentHealth to 0', () => {
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const questStore = useQuestStore();
    const { failQuest } = useCombatActions();
    const { isDead } = useDeathScreen();

    const quest = questStore.addQuest('Clean garage', 'hard', '2026-02-01');
    characterStore.character = { ...characterStore.character, currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 10000, magicAttack: 10000 });

    failQuest(quest.id);

    expect(isDead.value).toBe(true);
  });

  it('restart() leaves pending quests untouched — same precedent as habit streaks, which also survive a death/reset', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const questStore = useQuestStore();
    const { checkMissedHabit, restart } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', false, createRng());
    const quest = questStore.addQuest('Clean garage', 'medium', '2026-02-01');
    characterStore.character = { ...characterStore.character, currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3 });
    checkMissedHabit(habit.id);
    expect(isDead.value).toBe(true);

    restart();

    expect(characterStore.character.level).toBe(1); // sanity: a real reset happened
    expect(questStore.quests).toEqual([quest]); // the pending quest is untouched by the reset
  });

  it('addHabit stamps lastCheckedPeriodKey so a brand-new habit is not a false miss on the next rollover', () => {
    const habitStore = useHabitStore();
    const { addHabit } = useCombatActions();

    const daily = addHabit('Meditate', 'daily', 'medium', false);
    const weekly = addHabit('Prayer list', 'weekly', 'medium', false);

    const now = new Date();
    expect(habitStore.habits.find((h) => h.id === daily.id)?.lastCheckedPeriodKey).toBe(periodKeyFor('daily', now));
    expect(habitStore.habits.find((h) => h.id === weekly.id)?.lastCheckedPeriodKey).toBe(periodKeyFor('weekly', now));
  });

  describe('set days', () => {
    const today = dayOfWeekIndex(new Date());
    const notToday = (today + 1) % 7;

    it('checkOffHabit does nothing on a rest day', () => {
      const habitStore = useHabitStore();
      const bossStore = useBossStore();
      const { addHabit, checkOffHabit } = useCombatActions();
      const habit = addHabit('Gym', 'daily', 'medium', false, [notToday]);
      const bossHealth = bossStore.boss.health;
      checkOffHabit(habit.id);
      expect(habitStore.habits[0].lastCompletedPeriodKey).toBeNull();
      expect(bossStore.boss.health).toBe(bossHealth);
    });

    it('activateOverdrive is refused once today is taken out of a checked-off habit', () => {
      const habitStore = useHabitStore();
      const { addHabit, checkOffHabit, activateOverdrive } = useCombatActions();
      const habit = addHabit('Gym', 'daily', 'medium', false);
      habitStore.updateHabit({ ...habitStore.habits[0], isOverdrive: true });
      checkOffHabit(habit.id);
      habitStore.setHabitDays(habit.id, [notToday]);
      activateOverdrive(habit.id);
      expect(habitStore.habits[0].overdriveUsesThisPeriod ?? 0).toBe(0);
    });

    it('addHabit stamps the day it was added', () => {
      const { addHabit } = useCombatActions();
      expect(addHabit('Gym', 'daily', 'hard', false).createdDayKey).toBe(dailyPeriodKey(useDebugClockStore().now()));
    });

    it('addHabit stores days on a daily', () => {
      const { addHabit } = useCombatActions();
      expect(addHabit('Gym', 'daily', 'hard', false, [0, 2, 5]).days).toEqual([0, 2, 5]);
    });
  });

  describe('skill and kill EXP', () => {
    it('checking off the only daily pays a fifth of a level; Overdrive pays none', () => {
      const characterStore = useCharacterStore();
      const bossStore = useBossStore();
      const habitStore = useHabitStore();
      const { addHabit, checkOffHabit, activateOverdrive } = useCombatActions();
      bossStore.setBoss({ ...bossStore.boss, health: 1e9, maxHealth: 1e9 });
      const habit = addHabit('Gym', 'daily', 'medium', false);
      habitStore.updateHabit({ ...habitStore.habits[0], isOverdrive: true });

      checkOffHabit(habit.id);
      expect(characterStore.character.exp).toBeCloseTo(expToNextLevel(1) * 0.2, 10);
      activateOverdrive(habit.id);
      expect(characterStore.character.exp).toBeCloseTo(expToNextLevel(1) * 0.2, 10);
    });

    it('a kill logs the EXP the engine paid at the slayer\'s level', () => {
      const characterStore = useCharacterStore();
      const bossStore = useBossStore();
      const { addHabit, checkOffHabit } = useCombatActions();
      characterStore.character = { ...characterStore.character, level: 10, exp: 0 };
      bossStore.setBoss({ ...bossStore.boss, health: 0.0001, armor: 0 });
      const habit = addHabit('Gym', 'daily', 'medium', false);

      checkOffHabit(habit.id);
      const entry = useActivityLogStore().entries.find((e) => e.kind === 'boss-defeated');
      const amount = (entry as { amount: number }).amount;
      expect(amount).toBeGreaterThanOrEqual(expToNextLevel(10) * 0.4 * 0.9);
      expect(amount).toBeLessThanOrEqual(expToNextLevel(10) * 0.4 * 1.1);
      expect(characterStore.character.exp).toBeCloseTo(expToNextLevel(10) * 0.2 + amount, 10);
    });
  });

  describe('rank-up log', () => {
    function checkOff(overrides: Partial<Habit>) {
      const bossStore = useBossStore();
      const habitStore = useHabitStore();
      const { addHabit, checkOffHabit } = useCombatActions();
      bossStore.setBoss({ ...bossStore.boss, health: 1e9, maxHealth: 1e9 });
      const habit = addHabit('Run', 'daily', 'medium', false);
      habitStore.updateHabit({ ...habitStore.habits[0], ...overrides });
      checkOffHabit(habit.id);
      return useActivityLogStore().entries;
    }

    it('logs a rank-up above the skill\'s own entry', () => {
      const entries = checkOff({ streakCount: 9, rank: 0, damageType: 'physical' });
      expect(entries[0]).toMatchObject({ kind: 'rank-up', habitName: 'Run', rank: 1 });
      expect(entries[1]).toMatchObject({ kind: 'skill-damage', habitName: 'Run' });
    });

    it('logs nothing while a ranked skill rebuilds its streak', () => {
      expect(checkOff({ streakCount: 29, rank: 3, damageType: 'physical' }).some((e) => e.kind === 'rank-up')).toBe(false);
    });

    it('logs the next rank once the streak passes it', () => {
      // Streak 50 is also a milestone, so a level-up may land above it.
      expect(checkOff({ streakCount: 49, rank: 3, damageType: 'physical' }).find((e) => e.kind === 'rank-up')).toMatchObject({ rank: 4 });
    });
  });
});
