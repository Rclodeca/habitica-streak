// Composable exposing user-triggered combat actions: checking off a habit,
// marking one missed (used directly and by `useDailyRollover`), adding new
// habits, and restarting after death.
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
//
// Death is a two-step handoff to the UI rather than an automatic reset:
// `checkMissedHabit` only detects currentHealth <= 0 and flags it via
// `useDeathScreen().triggerDeath()`; the actual character/boss/habit reset
// happens in `restart()`, called once the player dismisses the death popup.

import {
  addExpAndResolveLevelUps,
  completeHabit,
  createRng,
  missHabit,
  periodKeyFor,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
} from '../game-engine';
import type { Difficulty, Habit, ItemDef, Period } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useDebugClockStore } from '../store/debugClockStore';
import { useHabitStore } from '../store/habitStore';
import { useDeathScreen } from './useDeathScreen';

// Shared across calls made through this composable. This is app runtime
// code (not `game-engine/`), so an unseeded Math.random()-backed Rng is
// acceptable here.
const rng = createRng();

export function useCombatActions() {
  const characterStore = useCharacterStore();
  const bossStore = useBossStore();
  const habitStore = useHabitStore();
  const debugClockStore = useDebugClockStore();
  const { triggerDeath, dismiss: dismissDeathScreen } = useDeathScreen();

  /**
   * Checks off a habit: resolves its combat outcome (boss damage or player
   * healing) exactly once via `completeHabit`, writes the single result
   * back into all three stores, grants any streak-milestone EXP, then
   * checks for — and applies — a boss defeat.
   *
   * Does not check for player death: habit completion never damages the
   * player, so a single `completeHabit` call cannot kill them.
   */
  function checkOffHabit(habitId: string): ItemDef[] {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return [];

    // Engine-level idempotency guard: this is the authoritative check that a
    // habit cannot be completed twice in the same period (double streak
    // increment, double boss damage, double milestone EXP), independent of
    // any UI-layer `:disabled` binding. Mirrors the `isCompletedThisPeriod`
    // predicate used in `HabitListItem.vue`.
    const currentPeriodKey = periodKeyFor(habit.period, debugClockStore.now());
    if (habit.lastCompletedPeriodKey === currentPeriodKey) return [];

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

    return defeatResult.itemsDropped;
  }

  /**
   * Marks a habit missed: resolves boss-attack damage to the player exactly
   * once via `missHabit`, writes the single result back into the character
   * and habit stores, then flags the death screen if that brought
   * currentHealth to 0 — the reset itself waits for `restart()`.
   */
  function checkMissedHabit(habitId: string): void {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return;

    const result = missHabit(characterStore.character, habit, bossStore.boss);

    characterStore.setCharacter(result.character);
    habitStore.updateHabit(result.updatedHabit);

    if (result.character.currentHealth <= 0) {
      triggerDeath();
    }
  }

  /** Thin wrapper around `habitStore.addHabit`, sharing this module's Rng. */
  function addHabit(name: string, period: Period, difficulty: Difficulty): Habit {
    return habitStore.addHabit(name, period, difficulty, rng);
  }

  /**
   * Performs the actual death reset (fresh character, boss back to index 1,
   * habits kept with re-rolled damage types) and closes the death screen.
   * Called once, from the "Restart" button — no-op if somehow not dead.
   */
  function restart(): void {
    const deathResult = resolvePlayerDeathIfDead(characterStore.character, bossStore.boss, habitStore.habits, rng);
    if (deathResult.died) {
      characterStore.setCharacter(deathResult.character);
      bossStore.setBoss(deathResult.boss);
      habitStore.setHabits(deathResult.habits);
    }
    dismissDeathScreen();
  }

  return { checkOffHabit, checkMissedHabit, addHabit, restart };
}
