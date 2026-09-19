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
//
// Bad habits invert which trigger resolves which outcome (see `Habit.isBad`
// in types.ts): checking one off resolves the *penalty* (`missHabit` —
// damage to the player) instead of the reward, and `checkAvoidedHabit`
// (called by `useMissedSkillsGate` when a rollover finds one un-checked, i.e.
// avoided) resolves the *reward* (`completeHabit` — damage to the boss)
// instead of the penalty. `applyReward`/`applyPenalty` below are the shared
// engine-invoking cores; the four public functions just wire each trigger to
// the right one and decide whether to stamp `lastCompletedPeriodKey` (only
// on a live tap, never on a rollover resolution).

import {
  addExpAndResolveLevelUps,
  completeHabit,
  createRng,
  effectiveStat,
  missHabit,
  periodKeyFor,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
  reviveWithFeatherIfEquipped,
} from '../game-engine';
import type { Character, Difficulty, Habit, ItemDef, Period } from '../game-engine';
import { useActivityLogStore } from '../store/activityLogStore';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useDebugClockStore } from '../store/debugClockStore';
import { useHabitStore } from '../store/habitStore';
import { useDeathScreen } from './useDeathScreen';
import { useReviveNotice } from './useReviveNotice';

// Shared across calls made through this composable. This is app runtime
// code (not `game-engine/`), so an unseeded Math.random()-backed Rng is
// acceptable here.
const rng = createRng();

export function useCombatActions() {
  const characterStore = useCharacterStore();
  const bossStore = useBossStore();
  const habitStore = useHabitStore();
  const activityLogStore = useActivityLogStore();
  const debugClockStore = useDebugClockStore();
  const { triggerDeath, dismiss: dismissDeathScreen } = useDeathScreen();
  const { showReviveNotice } = useReviveNotice();

  /**
   * Writes a `level-up` log entry if `after` is at a higher level than
   * `before` — a no-op otherwise. Stat deltas are derived (rather than
   * carried on the level-up result itself) since `addExpAndResolveLevelUps`
   * only returns the count of levels gained, not the resulting stat values.
   */
  function logLevelUpIfAny(before: Character, after: Character): void {
    if (after.level <= before.level) return;
    activityLogStore.addEntry({
      kind: 'level-up',
      newLevel: after.level,
      statDeltas: {
        physicalDamage: effectiveStat(after, 'physicalDamage') - effectiveStat(before, 'physicalDamage'),
        magicDamage: effectiveStat(after, 'magicDamage') - effectiveStat(before, 'magicDamage'),
        healing: effectiveStat(after, 'healing') - effectiveStat(before, 'healing'),
        health: effectiveStat(after, 'health') - effectiveStat(before, 'health'),
      },
    });
  }

  /**
   * Shared reward core: resolves the combat outcome (boss damage or player
   * healing) exactly once via `completeHabit`, writes the result back into
   * all three stores, grants any streak-milestone EXP, then checks for —
   * and applies — a boss defeat. Used for both a good habit's checkbox tap
   * and a bad habit's rollover-detected avoidance. `stampPeriodKey`, when
   * given, also marks the habit completed for that period — only correct
   * for a live tap; a rollover resolution leaves it untouched.
   *
   * Never checks for player death: this path never damages the player, so
   * it cannot kill them.
   */
  function applyReward(habitId: string, stampPeriodKey?: string): ItemDef[] {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return [];

    const habitsInPool = habitStore.habitsOfType(habit.damageType, habit.isBad);
    const healthBefore = characterStore.character.currentHealth;
    const result = completeHabit(characterStore.character, habit, habitsInPool, bossStore.boss, rng);

    const updatedHabit: Habit = stampPeriodKey
      ? { ...result.updatedHabit, lastCompletedPeriodKey: stampPeriodKey, lastCheckedPeriodKey: stampPeriodKey }
      : result.updatedHabit;

    characterStore.setCharacter(result.character);
    bossStore.setBoss(result.boss);
    habitStore.updateHabit(updatedHabit);

    if (habit.damageType === 'healing') {
      activityLogStore.addEntry({
        kind: 'heal',
        habitName: habit.name,
        amount: result.character.currentHealth - healthBefore,
      });
    } else if (result.damageDealt !== undefined) {
      // Sub-effect entries pushed before the main one so the main "skill
      // used" entry — the headline of this action — lands on top (newest).
      if (result.wasCrit) activityLogStore.addEntry({ kind: 'crit', by: 'player' });
      if (result.lifestealHealed) {
        activityLogStore.addEntry({ kind: 'lifesteal', amount: result.lifestealHealed, healedWho: 'player' });
      }
      if (result.reflectedDamage) {
        activityLogStore.addEntry({ kind: 'reflect', amount: result.reflectedDamage });
      }
      activityLogStore.addEntry({ kind: 'skill-damage', habitName: habit.name, amount: result.damageDealt });
    }

    if (result.milestoneExp > 0) {
      const beforeLevelUp = characterStore.character;
      const { character } = addExpAndResolveLevelUps(beforeLevelUp, result.milestoneExp);
      logLevelUpIfAny(beforeLevelUp, character);
      characterStore.setCharacter(character);
    }

    const beforeDefeat = characterStore.character;
    const defeatResult = resolveBossDefeatIfDead(characterStore.character, bossStore.boss, rng);
    if (defeatResult.defeated) {
      activityLogStore.addEntry({ kind: 'boss-defeated', bossIndex: bossStore.boss.index });
      logLevelUpIfAny(beforeDefeat, defeatResult.character);
      characterStore.setCharacter(defeatResult.character);
      bossStore.setBoss(defeatResult.boss);
    }

    return defeatResult.itemsDropped;
  }

  /**
   * Shared penalty core: resolves boss-attack damage to the player exactly
   * once via `missHabit`, writes the result back into the character, boss
   * (a lifesteal boss heals off this same attack), and habit stores, then
   * checks for death. Used for both a good habit's rollover-detected miss
   * and a bad habit's checkbox tap. `stampPeriodKey` mirrors `applyReward`'s.
   *
   * If the damage brought currentHealth to 0, checks for an equipped
   * Phoenix Feather: if present, it's consumed and the character revives
   * immediately (no death screen); otherwise the death screen is flagged
   * and the actual reset waits for `restart()`.
   */
  function applyPenalty(habitId: string, stampPeriodKey?: string): void {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return;

    const healthBefore = characterStore.character.currentHealth;
    const result = missHabit(characterStore.character, habit, bossStore.boss, rng);

    const updatedHabit: Habit = stampPeriodKey
      ? { ...result.updatedHabit, lastCompletedPeriodKey: stampPeriodKey, lastCheckedPeriodKey: stampPeriodKey }
      : result.updatedHabit;

    characterStore.setCharacter(result.character);
    bossStore.setBoss(result.boss);
    habitStore.updateHabit(updatedHabit);

    // Sub-effect entries pushed before the main one so the main "hit" entry
    // — the headline of this action — lands on top (newest).
    if (result.wasCrit) activityLogStore.addEntry({ kind: 'crit', by: 'boss' });
    if (result.bossLifestealHealed) {
      activityLogStore.addEntry({ kind: 'lifesteal', amount: result.bossLifestealHealed, healedWho: 'boss' });
    }
    activityLogStore.addEntry({
      kind: 'hit',
      habitName: habit.name,
      amount: healthBefore - result.character.currentHealth,
    });

    // Rounded, not the raw float: the health bar already displays
    // Math.round(currentHealth), so a tiny positive remainder (e.g. 0.3)
    // would otherwise show as "0 HP" without actually triggering death.
    if (Math.round(result.character.currentHealth) <= 0) {
      const reviveResult = reviveWithFeatherIfEquipped(result.character);
      if (reviveResult.revived) {
        characterStore.setCharacter(reviveResult.character);
        showReviveNotice();
      } else {
        triggerDeath();
      }
    }
  }

  /**
   * Checks off a habit. For a good habit this resolves the reward
   * (`applyReward`); for a bad habit it resolves the penalty
   * (`applyPenalty` — you just admitted doing the bad thing). Either way,
   * stamps the habit completed for the current period.
   *
   * Engine-level idempotency guard: this is the authoritative check that a
   * habit cannot be resolved twice in the same period (double streak
   * change, double damage, double milestone EXP), independent of any
   * UI-layer `:disabled` binding. Mirrors the `isCompletedThisPeriod`
   * predicate used in `HabitListItem.vue`.
   */
  function checkOffHabit(habitId: string): ItemDef[] {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return [];

    const currentPeriodKey = periodKeyFor(habit.period, debugClockStore.now());
    if (habit.lastCompletedPeriodKey === currentPeriodKey) return [];

    if (habit.isBad) {
      applyPenalty(habitId, currentPeriodKey);
      return [];
    }
    return applyReward(habitId, currentPeriodKey);
  }

  /**
   * Resolves a good habit's rollover-detected miss (penalty) — called only
   * from `useMissedSkillsGate.acknowledge()` once the player has seen the
   * popup. Doesn't stamp `lastCompletedPeriodKey`: a rollover resolution
   * was never an active tap, so completion status for the period stays
   * untouched (`lastCheckedPeriodKey` is stamped separately by the gate).
   */
  function checkMissedHabit(habitId: string): void {
    applyPenalty(habitId);
  }

  /**
   * Resolves a bad habit's rollover-detected avoidance (reward) — the bad-
   * habit counterpart to `checkMissedHabit`, called the same way from
   * `useMissedSkillsGate.acknowledge()`.
   */
  function checkAvoidedHabit(habitId: string): ItemDef[] {
    return applyReward(habitId);
  }

  /** Thin wrapper around `habitStore.addHabit`, sharing this module's Rng. */
  function addHabit(name: string, period: Period, difficulty: Difficulty, isBad: boolean): Habit {
    return habitStore.addHabit(name, period, difficulty, isBad, rng);
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

  return { checkOffHabit, checkMissedHabit, checkAvoidedHabit, addHabit, restart };
}
