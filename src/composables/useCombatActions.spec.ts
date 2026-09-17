// @vitest-environment jsdom
//
// This composable reads/writes Pinia store state, which is fine under the
// project's default `node` test environment — but we still want a DOM
// present in case any transitive dependency expects one, matching the
// convention used by `store/index.spec.ts` and `useDailyRollover.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRng, periodKeyFor } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useCombatActions } from './useCombatActions';
import { useDeathScreen } from './useDeathScreen';

describe('useCombatActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // `isDead` is a module-scope singleton (see useDeathScreen.ts) — dismiss
  // it after every test so a death triggered in one test can't leak into
  // the next.
  afterEach(() => {
    useDeathScreen().dismiss();
  });

  it('checkOffHabit is a no-op when called a second time on a habit already completed this period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', createRng());

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

  it('checkOffHabit returns the items dropped when completing a habit defeats the boss', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Slay the boss', 'daily', 'hard', createRng());
    habitStore.updateHabit({ ...habit, damageType: 'physical' }); // deterministic damage type
    bossStore.setBoss({ ...bossStore.boss, health: 0.0001, armor: 0 }); // one hit from defeat

    const itemsDropped = checkOffHabit(habit.id);

    expect(itemsDropped.length).toBeGreaterThan(0);
  });

  it('checkOffHabit returns [] when the habit completion does not defeat the boss', () => {
    const habitStore = useHabitStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Meditate', 'daily', 'easy', createRng());

    const itemsDropped = checkOffHabit(habit.id);

    expect(itemsDropped).toEqual([]);
  });

  it('checkMissedHabit flags the death screen instead of resetting immediately when it brings currentHealth to 0', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', createRng());
    characterStore.character = { ...characterStore.character, currentHealth: 1 };
    bossStore.setBoss({ ...bossStore.boss, physicalAttack: 1000, magicAttack: 1000, index: 3 });

    checkMissedHabit(habit.id);

    expect(isDead.value).toBe(true);
    // No auto-reset yet — character/boss are left exactly as the miss left them.
    expect(characterStore.character.currentHealth).toBe(0);
    expect(bossStore.boss.index).toBe(3);
  });

  it('restart resets character/boss/habits and clears the death flag', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkMissedHabit, restart } = useCombatActions();
    const { isDead } = useDeathScreen();

    const habit = habitStore.addHabit('Exercise', 'daily', 'hard', createRng());
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
});
