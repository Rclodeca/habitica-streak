// Composable exposing user-triggered combat actions: checking off a habit,
// marking one missed (used directly and by `useDailyRollover`), and adding
// new habits.
//
// Orchestration rule: `completeHabit`/`missHabit`/`resolveBossDefeatIfDead`/
// `resolvePlayerDeathIfDead` each touch up to three stores' worth of state
// from a single call. To guarantee every game-engine combat function runs
// exactly once per user action, this composable calls the RAW game-engine
// functions (imported directly from `../game-engine`, never a store's own
// domain-specific wrapper action) and writes each single result back into
// all affected stores via their plain setters (`setCharacter`, `setBoss`,
// `updateHabit`, `setHabits`). This keeps all three stores consistent with
// one authoritative result instead of re-deriving state per store.

import {
  addExpAndResolveLevelUps,
  completeHabit,
  createRng,
  missHabit,
  periodKeyFor,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
} from '../game-engine';
import type { Difficulty, Habit, Period } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';

// Shared across calls made through this composable. This is app runtime
// code (not `game-engine/`), so an unseeded Math.random()-backed Rng is
// acceptable here.
const rng = createRng();

export function useCombatActions() {
  const characterStore = useCharacterStore();
  const bossStore = useBossStore();
  const habitStore = useHabitStore();

  /**
   * Checks off a habit: resolves its combat outcome (boss damage or player
   * healing) exactly once via `completeHabit`, writes the single result
   * back into all three stores, grants any streak-milestone EXP, then
   * checks for — and applies — a boss defeat.
   *
   * Does not check for player death: habit completion never damages the
   * player, so a single `completeHabit` call cannot kill them.
   */
  function checkOffHabit(habitId: string): void {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return;

    // Engine-level idempotency guard: this is the authoritative check that a
    // habit cannot be completed twice in the same period (double streak
    // increment, double boss damage, double milestone EXP), independent of
    // any UI-layer `:disabled` binding. Mirrors the `isCompletedThisPeriod`
    // predicate used in `HabitListItem.vue`.
    const currentPeriodKey = periodKeyFor(habit.period, new Date());
    if (habit.lastCompletedPeriodKey === currentPeriodKey) return;

    const allHabitsOfSameType = habitStore.habitsOfType(habit.damageType);
    const result = completeHabit(characterStore.character, habit, allHabitsOfSameType, bossStore.boss);

    const updatedHabit: Habit = {
      ...result.updatedHabit,
      lastCompletedPeriodKey: currentPeriodKey,
      lastCheckedPeriodKey: currentPeriodKey,
    };

    characterStore.setCharacter(result.character);
    bossStore.setBoss(result.boss);
    habitStore.updateHabit(updatedHabit);

    if (result.milestoneExp > 0) {
      const { character } = addExpAndResolveLevelUps(characterStore.character, result.milestoneExp);
      characterStore.setCharacter(character);
    }

    const defeatResult = resolveBossDefeatIfDead(characterStore.character, bossStore.boss, rng);
    if (defeatResult.defeated) {
      characterStore.setCharacter(defeatResult.character);
      bossStore.setBoss(defeatResult.boss);
    }
  }

  /**
   * Marks a habit missed: resolves boss-attack damage to the player exactly
   * once via `missHabit`, writes the single result back into the character
   * and habit stores, then checks for — and applies — a player death.
   */
  function checkMissedHabit(habitId: string): void {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return;

    const result = missHabit(characterStore.character, habit, bossStore.boss);

    characterStore.setCharacter(result.character);
    habitStore.updateHabit(result.updatedHabit);

    const deathResult = resolvePlayerDeathIfDead(
      characterStore.character,
      bossStore.boss,
      habitStore.habits,
      rng,
    );
    if (deathResult.died) {
      characterStore.setCharacter(deathResult.character);
      bossStore.setBoss(deathResult.boss);
      habitStore.setHabits(deathResult.habits);
    }
  }

  /** Thin wrapper around `habitStore.addHabit`, sharing this module's Rng. */
  function addHabit(name: string, period: Period, difficulty: Difficulty): Habit {
    return habitStore.addHabit(name, period, difficulty, rng);
  }

  return { checkOffHabit, checkMissedHabit, addHabit };
}
