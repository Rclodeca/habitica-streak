// @vitest-environment jsdom
//
// This composable reads/writes Pinia store state, which is fine under the
// project's default `node` test environment — but we still want a DOM
// present in case any transitive dependency expects one, matching the
// convention used by `store/index.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRng, dailyPeriodKey, dayOfWeekIndex, ITEM_CATALOG, periodKeyFor } from '../game-engine';
import { useActivityLogStore } from '../store/activityLogStore';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useQuestStore } from '../store/questStore';
import { useDailyRollover } from './useDailyRollover';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useQuestMissGate } from './useQuestMissGate';

describe('useDailyRollover', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // `pending` in useMissedSkillsGate is a module-scope singleton — clear
    // it so a miss queued in one test doesn't leak into the next.
    useMissedSkillsGate().acknowledge();
  });

  it('Ember Heart heals once per day at rollover and logs it', () => {
    const characterStore = useCharacterStore();
    const activityLogStore = useActivityLogStore();
    characterStore.setCharacter({ ...characterStore.character, currentHealth: 10, ownedItemIds: ['ember-heart'], equippedItemIds: ['ember-heart'] });

    useDailyRollover(new Date());
    const healedOnce = characterStore.character.currentHealth;
    useDailyRollover(new Date());

    expect(healedOnce).toBeGreaterThan(10);
    expect(characterStore.character.currentHealth).toBe(healedOnce);
    expect(activityLogStore.entries.filter((e) => e.kind === 'item-heal')).toHaveLength(1);
    expect(activityLogStore.entries[0]).toMatchObject({ kind: 'item-heal', itemName: 'Ember Heart' });
  });

  it('leaves the character untouched at rollover without Ember Heart', () => {
    const characterStore = useCharacterStore();
    const before = characterStore.character;
    useDailyRollover(new Date());
    expect(characterStore.character).toBe(before);
  });

  it('lands a due Doom at rollover when nothing is queued', () => {
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    characterStore.setCharacter({ ...characterStore.character, currentHealth: 1000 });
    bossStore.setBoss({ ...bossStore.boss, doomDueDayKey: dailyPeriodKey(new Date()) });

    useDailyRollover(new Date());

    expect(characterStore.character.currentHealth).toBeCloseTo(500, 10);
    expect(bossStore.boss.doomDueDayKey).toBeUndefined();
    expect(useActivityLogStore().entries[0]).toMatchObject({ kind: 'doom-landed' });
  });

  it('holds a due Doom while the missed-skills popup is up', () => {
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const habit = useHabitStore().addHabit('Meditate', 'daily', 'medium', false, createRng());
    characterStore.setCharacter({ ...characterStore.character, currentHealth: 1000 });
    bossStore.setBoss({ ...bossStore.boss, doomDueDayKey: dailyPeriodKey(new Date()) });
    useMissedSkillsGate().queueMiss(habit, '2024-01-02');

    useDailyRollover(new Date());

    expect(characterStore.character.currentHealth).toBe(1000);
    expect(bossStore.boss.doomDueDayKey).toBeDefined();
  });

  it('queues a miss (without applying damage) for a daily habit not completed in the preceding period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore(); // bootstraps the boss slice used internally by miss resolution

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    // Simulate "last app-open was yesterday, and yesterday's occurrence was
    // never checked off": streak was already built up, last-checked stamp
    // is yesterday's period key, and it was never completed in that period.
    habitStore.updateHabit({
      ...habit,
      streakCount: 3,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: null,
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    // Detection queues the miss but doesn't resolve it yet — that waits for
    // the popup to be acknowledged.
    expect(characterStore.character.currentHealth).toBe(healthBefore);
    expect(updatedHabit?.streakCount).toBe(3);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(yesterdayKey);
    expect(useMissedSkillsGate().misses.value).toEqual([
      {
        habitId: habit.id,
        habitName: 'Meditate',
        difficulty: habit.difficulty,
        period: habit.period,
        periodKeyToStamp: currentPeriodKey,
        outcome: 'penalty',
      },
    ]);
  });

  it('applies the queued miss (damage, streak reset, stamp) once acknowledged', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    habitStore.updateHabit({
      ...habit,
      streakCount: 3,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: null,
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);
    useMissedSkillsGate().acknowledge();

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(updatedHabit?.streakCount).toBe(0);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('does not record a miss for a habit already completed in the preceding period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Stretch', 'daily', 'easy', false, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    habitStore.updateHabit({
      ...habit,
      streakCount: 5,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: yesterdayKey, // completed yesterday, the immediately-preceding period
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character.currentHealth).toBe(healthBefore);
    expect(updatedHabit?.streakCount).toBe(5); // untouched — no miss recorded
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('does not re-check a habit already stamped for the current period (no double-processing)', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Journal', 'daily', 'hard', false, createRng());
    const now = new Date();
    const currentPeriodKey = periodKeyFor('daily', now);

    habitStore.updateHabit({
      ...habit,
      streakCount: 2,
      lastCheckedPeriodKey: currentPeriodKey, // already checked this period
      lastCompletedPeriodKey: null,
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);

    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);
    expect(characterStore.character.currentHealth).toBe(healthBefore);
    expect(updatedHabit?.streakCount).toBe(2);
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('queues a reward (without applying boss damage) for a bad habit not checked in the preceding period', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    useCharacterStore();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    // Simulate "last app-open was yesterday, and the bad habit was never
    // tapped yesterday" — i.e. it was avoided.
    habitStore.updateHabit({
      ...habit,
      streakCount: 3,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: null,
    });

    const bossHealthBefore = bossStore.boss.health;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    // Detection queues the reward but doesn't resolve it yet — that waits
    // for the popup to be acknowledged.
    expect(bossStore.boss.health).toBe(bossHealthBefore);
    expect(updatedHabit?.streakCount).toBe(3);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(yesterdayKey);
    expect(useMissedSkillsGate().rewards.value).toEqual([
      {
        habitId: habit.id,
        habitName: 'Skip dessert',
        difficulty: habit.difficulty,
        period: habit.period,
        periodKeyToStamp: currentPeriodKey,
        outcome: 'reward',
      },
    ]);
  });

  it('does not record a reward for a bad habit that was checked (done) in the preceding period', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    useCharacterStore();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    habitStore.updateHabit({
      ...habit,
      streakCount: 0,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: yesterdayKey, // the bad habit was done yesterday — already penalized at tap time
    });

    const bossHealthBefore = bossStore.boss.health;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(bossStore.boss.health).toBe(bossHealthBefore);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
    expect(useMissedSkillsGate().rewards.value).toEqual([]);
  });
});

describe('useDailyRollover — quests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    useQuestMissGate().acknowledge();
  });

  it('queues a miss for a quest whose due date is strictly before today', () => {
    const questStore = useQuestStore();
    const now = new Date();
    const yesterday = dailyPeriodKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const quest = questStore.addQuest('Clean garage', 'medium', yesterday);

    useDailyRollover(now);

    expect(useQuestMissGate().misses.value).toEqual([
      { questId: quest.id, description: 'Clean garage', dueDateKey: yesterday, difficulty: 'medium', kind: 'regular', rewardText: 'Medium EXP' },
    ]);
  });

  it('queues a miss for a past-due side quest too, offering its item as the override reward', () => {
    const questStore = useQuestStore();
    useCharacterStore();
    const now = new Date();
    const yesterday = dailyPeriodKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const itemId = 'ember-heart';
    const quest = questStore.addQuest('Slay it', 'hard', yesterday, 'side', itemId);

    useDailyRollover(now);

    const [miss] = useQuestMissGate().misses.value;
    expect(miss).toMatchObject({ questId: quest.id, kind: 'side' });
    expect(miss.rewardText).toBe(ITEM_CATALOG.find((i) => i.id === itemId)!.name);
  });

  it('does not queue a miss for a quest due exactly today', () => {
    const questStore = useQuestStore();
    const now = new Date();
    questStore.addQuest('Clean garage', 'medium', dailyPeriodKey(now));

    useDailyRollover(now);

    expect(useQuestMissGate().misses.value).toEqual([]);
  });

  it('does not queue a miss for a quest due in the future', () => {
    const questStore = useQuestStore();
    const now = new Date();
    const tomorrow = dailyPeriodKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    questStore.addQuest('Clean garage', 'medium', tomorrow);

    useDailyRollover(now);

    expect(useQuestMissGate().misses.value).toEqual([]);
  });
});

describe('useDailyRollover — set days', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    useMissedSkillsGate().acknowledge();
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = periodKeyFor('daily', yesterday);
  const yDay = dayOfWeekIndex(yesterday);

  // A habit last checked yesterday and never completed, due on `days`.
  function addUnfinished(days: number[], isBad = false) {
    const habitStore = useHabitStore();
    useBossStore();
    const habit = habitStore.addHabit('Gym', 'daily', 'medium', isBad, createRng(), days);
    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: yesterdayKey, lastCompletedPeriodKey: null });
    return habit;
  }

  it('a set-day habit resting yesterday queues nothing and is stamped', () => {
    const habit = addUnfinished([(yDay + 1) % 7]);
    useDailyRollover(now);
    expect(useMissedSkillsGate().misses.value).toHaveLength(0);
    const updatedHabit = useHabitStore().habits.find((h) => h.id === habit.id);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(periodKeyFor('daily', now));
  });

  it('a set-day habit due yesterday and not done queues a miss', () => {
    addUnfinished([yDay]);
    useDailyRollover(now);
    expect(useMissedSkillsGate().misses.value).toHaveLength(1);
  });

  it('a bad set-day habit resting yesterday earns no reward', () => {
    addUnfinished([(yDay + 1) % 7], true);
    useDailyRollover(now);
    expect(useMissedSkillsGate().rewards.value).toHaveLength(0);
  });

  it('a miss on a due day still counts when the app was not opened on the rest day after it', () => {
    const twoAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const habitStore = useHabitStore();
    useBossStore();
    const habit = habitStore.addHabit('Gym', 'daily', 'medium', false, createRng(), [dayOfWeekIndex(twoAgo)]);
    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: periodKeyFor('daily', twoAgo), lastCompletedPeriodKey: null });
    useDailyRollover(now);
    expect(useMissedSkillsGate().misses.value).toHaveLength(1);
  });

  it('a bad set-day habit avoided on its last due day still earns its reward after an unopened rest day', () => {
    const twoAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const habitStore = useHabitStore();
    useBossStore();
    const habit = habitStore.addHabit('Junk food', 'daily', 'medium', true, createRng(), [dayOfWeekIndex(twoAgo)]);
    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: periodKeyFor('daily', twoAgo), lastCompletedPeriodKey: null });
    useDailyRollover(now);
    expect(useMissedSkillsGate().rewards.value).toHaveLength(1);
  });

  it('a due day already resolved before a rest day is not looked at again', () => {
    const twoAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    addUnfinished([dayOfWeekIndex(twoAgo)]); // last checked yesterday, a rest day
    useDailyRollover(now);
    expect(useMissedSkillsGate().misses.value).toHaveLength(0);
  });
});

describe('useDailyRollover — run again before the popup is acknowledged', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    useMissedSkillsGate().acknowledge();
    useQuestMissGate().acknowledge();
  });

  it('queues a missed habit only once', () => {
    const habitStore = useHabitStore();
    useBossStore();
    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());
    const now = new Date();
    const yesterdayKey = periodKeyFor('daily', new Date(now.getTime() - 24 * 60 * 60 * 1000));
    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: yesterdayKey, lastCompletedPeriodKey: null });

    useDailyRollover(now);
    useDailyRollover(now);

    expect(useMissedSkillsGate().misses.value).toHaveLength(1);
  });

  it('queues an avoided bad habit only once', () => {
    const habitStore = useHabitStore();
    useBossStore();
    const habit = habitStore.addHabit('Doomscroll', 'daily', 'medium', true, createRng());
    const now = new Date();
    const yesterdayKey = periodKeyFor('daily', new Date(now.getTime() - 24 * 60 * 60 * 1000));
    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: yesterdayKey, lastCompletedPeriodKey: null });

    useDailyRollover(now);
    useDailyRollover(now);

    expect(useMissedSkillsGate().rewards.value).toHaveLength(1);
  });

  it('queues an overdue quest only once', () => {
    const questStore = useQuestStore();
    const now = new Date();
    const yesterday = dailyPeriodKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    questStore.addQuest('Clean garage', 'medium', yesterday);

    useDailyRollover(now);
    useDailyRollover(now);

    expect(useQuestMissGate().misses.value).toHaveLength(1);
  });
});
