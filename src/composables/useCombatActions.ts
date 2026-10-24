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
  availableRelics,
  bossExpReward,
  completeHabit,
  createRng,
  dailyPeriodKey,
  DEFAULT_HERO_NAME,
  effectiveCritChance,
  effectiveStat,
  describeItemBonus,
  ITEM_CATALOG,
  isDueOn,
  itemDoubleFactor,
  missHabit,
  overdriveHabit,
  overdriveUsesRemaining,
  periodKeyFor,
  questMissDamage,
  questRewardExp,
  questWeekFor,
  recordQuestCompletion,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
  reviveWithFeatherIfEquipped,
  unlockQuests,
  weeklyPeriodKey,
} from '../game-engine';
import type { Character, Difficulty, Habit, ItemDef, Period } from '../game-engine';
import { useActivityLogStore } from '../store/activityLogStore';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useDebugClockStore } from '../store/debugClockStore';
import { useHabitStore } from '../store/habitStore';
import { useHighScoreStore } from '../store/highScoreStore';
import { useQuestStore } from '../store/questStore';
import { useDeathScreen } from './useDeathScreen';
import { useFallenHero } from './useFallenHero';
import { useItemDropQueue } from './useItemDropQueue';
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
  const questStore = useQuestStore();
  const debugClockStore = useDebugClockStore();
  const highScoreStore = useHighScoreStore();
  const { triggerDeath, dismiss: dismissDeathScreen } = useDeathScreen();
  const { recordFallen } = useFallenHero();
  const { showReviveNotice } = useReviveNotice();
  const { enqueueDrops } = useItemDropQueue();

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
      // Isolates the level-up heal (TUNING.LEVEL_UP_HEAL_PCT + lifesteal%,
      // see addExpAndResolveLevelUps): nothing else changes currentHealth
      // between these two specific snapshots.
      healthRestored: after.currentHealth - before.currentHealth,
      statDeltas: {
        physicalDamage: effectiveStat(after, 'physicalDamage') - effectiveStat(before, 'physicalDamage'),
        magicDamage: effectiveStat(after, 'magicDamage') - effectiveStat(before, 'magicDamage'),
        healing: effectiveStat(after, 'healing') - effectiveStat(before, 'healing'),
        health: effectiveStat(after, 'health') - effectiveStat(before, 'health'),
        trueDamage: effectiveStat(after, 'trueDamage') - effectiveStat(before, 'trueDamage'),
      },
    });
  }

  /** Queues one event pick per level gained; the player resolves them in EventChoiceModal. */
  function grantEventPicks(levelsGained: number): void {
    if (levelsGained <= 0) return;
    const character = characterStore.character;
    characterStore.setCharacter({ ...character, pendingEventPicks: (character.pendingEventPicks ?? 0) + levelsGained });
  }

  /**
   * Shared reward core: resolves the combat outcome (boss damage or player
   * healing) exactly once via `completeHabit` (or `overdriveHabit` for an
   * Overdrive activation), writes the result back into all three stores,
   * grants any streak-milestone EXP, then checks for — and applies — a boss
   * defeat. Used for a good habit's checkbox tap, a bad habit's
   * rollover-detected avoidance, and an Overdrive activation.
   * `stampPeriodKey`, when given, also marks the habit completed for that
   * period — only correct for a live tap; a rollover resolution or an
   * Overdrive activation (already completed) leaves it untouched.
   *
   * Never checks for player death: this path never damages the player, so
   * it cannot kill them.
   */
  function applyReward(
    habitId: string,
    stampPeriodKey?: string,
    options: { isOverdriveUse?: boolean } = {},
  ): { itemsDropped: ItemDef[] } {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return { itemsDropped: [] };

    const habitsInPool = habitStore.habitsOfType(habit.damageType, habit.period);
    const healthBefore = characterStore.character.currentHealth;
    const currentPeriodKey = periodKeyFor(habit.period, debugClockStore.now());
    // Always the daily key (never the habit's own period key) — Wounds
    // duration always runs in days, even for a weekly habit. See
    // healingMultiplier/activeWoundsEffect in game-engine/combat.ts.
    const currentDayKey = dailyPeriodKey(debugClockStore.now());
    const result = options.isOverdriveUse
      ? overdriveHabit(characterStore.character, habit, habitsInPool, bossStore.boss, currentDayKey, currentPeriodKey, rng)
      : completeHabit(characterStore.character, habit, habitsInPool, bossStore.boss, currentDayKey, rng);

    const updatedHabit: Habit = stampPeriodKey
      ? { ...result.updatedHabit, lastCompletedPeriodKey: stampPeriodKey, lastCheckedPeriodKey: stampPeriodKey }
      : result.updatedHabit;

    characterStore.setCharacter(result.character);
    bossStore.setBoss(result.boss);
    habitStore.updateHabit(updatedHabit);

    if (habit.damageType === 'healing') {
      // Censer of Wrath: the heal also hit the boss (as true damage).
      if (result.damageDealt) {
        activityLogStore.addEntry({ kind: 'skill-damage', habitName: habit.name, amount: result.damageDealt, isTrueDamage: true });
      }
      activityLogStore.addEntry({
        kind: 'heal',
        habitName: habit.name,
        amount: result.character.currentHealth - healthBefore,
        milestoneExp: result.milestoneExp,
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
      activityLogStore.addEntry({
        kind: 'skill-damage',
        habitName: habit.name,
        amount: result.damageDealt,
        isTrueDamage: habit.damageType === 'trueDamage',
        milestoneExp: result.milestoneExp,
      });
    }

    if (result.milestoneExp > 0) {
      const beforeLevelUp = characterStore.character;
      const { character, levelsGained } = addExpAndResolveLevelUps(beforeLevelUp, result.milestoneExp);
      logLevelUpIfAny(beforeLevelUp, character);
      characterStore.setCharacter(character);
      grantEventPicks(levelsGained);
    }

    const beforeDefeat = characterStore.character;
    const defeatResult = resolveBossDefeatIfDead(characterStore.character, bossStore.boss, rng);
    if (defeatResult.defeated) {
      activityLogStore.addEntry({ kind: 'boss-defeated', bossIndex: bossStore.boss.index, amount: bossExpReward(bossStore.boss.index) });
      if (defeatResult.itemHealed) activityLogStore.addEntry({ kind: 'item-heal', itemName: 'Soul Lantern', amount: defeatResult.itemHealed });
      logLevelUpIfAny(beforeDefeat, defeatResult.character);
      characterStore.setCharacter(defeatResult.character);
      bossStore.setBoss(defeatResult.boss);
      grantEventPicks(defeatResult.levelsGained);
    }

    return { itemsDropped: defeatResult.itemsDropped };
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
    const currentDayKey = dailyPeriodKey(debugClockStore.now());
    const result = missHabit(characterStore.character, habit, bossStore.boss, currentDayKey, rng);

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
    if (result.woundsApplied) {
      activityLogStore.addEntry({
        kind: 'wounds-applied',
        durationDays: result.woundsApplied.durationDays,
        effectRate: result.woundsApplied.effectRate,
      });
    }
    activityLogStore.addEntry({
      kind: 'hit',
      habitName: habit.name,
      amount: healthBefore - result.character.currentHealth,
      attackType: result.attackType,
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
   * predicate used in `HabitListItem.vue`. A set-day habit can't be
   * checked off on a rest day either (`isDueOn`).
   */
  function checkOffHabit(habitId: string): { itemsDropped: ItemDef[] } {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return { itemsDropped: [] };
    if (!isDueOn(habit, debugClockStore.now())) return { itemsDropped: [] };

    const currentPeriodKey = periodKeyFor(habit.period, debugClockStore.now());
    if (habit.lastCompletedPeriodKey === currentPeriodKey) return { itemsDropped: [] };

    if (habit.isBad) {
      applyPenalty(habitId, currentPeriodKey);
      return { itemsDropped: [] };
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
  function checkAvoidedHabit(habitId: string): { itemsDropped: ItemDef[] } {
    return applyReward(habitId);
  }

  /**
   * Activates one of a habit's Overdrive extra uses (see `Habit.isOverdrive`)
   * at reduced damage. Good-habit-only, gated on the habit already being
   * checked off this period and having uses remaining — the authoritative
   * guard, independent of the UI button's `:disabled` binding, mirroring
   * `checkOffHabit`'s own period-key guard above. Refused on a rest day even
   * if the habit was checked off before today was taken out of its days.
   */
  function activateOverdrive(habitId: string): { itemsDropped: ItemDef[] } {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit || habit.isBad || !habit.isOverdrive) return { itemsDropped: [] };
    if (!isDueOn(habit, debugClockStore.now())) return { itemsDropped: [] };

    const currentPeriodKey = periodKeyFor(habit.period, debugClockStore.now());
    if (habit.lastCompletedPeriodKey !== currentPeriodKey) return { itemsDropped: [] };
    if (overdriveUsesRemaining(habit, currentPeriodKey) <= 0) return { itemsDropped: [] };

    return applyReward(habitId, undefined, { isOverdriveUse: true });
  }

  /**
   * Thin wrapper around `habitStore.addHabit`, sharing this module's Rng.
   */
  function addHabit(name: string, period: Period, difficulty: Difficulty, isBad: boolean, days?: number[]): Habit {
    const created = habitStore.addHabit(name, period, difficulty, isBad, rng, days);
    // Stamped so the next rollover doesn't count the period before this
    // habit existed as a miss.
    const habit = { ...created, lastCheckedPeriodKey: periodKeyFor(period, debugClockStore.now()) };
    habitStore.updateHabit(habit);
    return habit;
  }

  /**
   * Performs the actual death reset (fresh character, boss back to index 1,
   * habits kept with re-rolled damage types) and closes the death screen.
   * Called once, from the "Restart" button — no-op if somehow not dead.
   *
   * Snapshots the just-ended run into the high-score leaderboard first,
   * reading the character/boss/habits BEFORE `resolvePlayerDeathIfDead`
   * overwrites them — this is the only place that run's peak state is still
   * available.
   */
  function restart(): void {
    const character = characterStore.character;
    const bossIndexAtDeath = bossStore.boss.index;
    const habits = habitStore.habits;

    const deathResult = resolvePlayerDeathIfDead(character, bossStore.boss, habits, rng);
    if (deathResult.died) {
      highScoreStore.recordRunEnd({
        bossIndex: bossIndexAtDeath,
        level: character.level,
        endedDayKey: dailyPeriodKey(debugClockStore.now()),
        stats: {
          physicalDamage: effectiveStat(character, 'physicalDamage'),
          magicDamage: effectiveStat(character, 'magicDamage'),
          healing: effectiveStat(character, 'healing'),
          health: effectiveStat(character, 'health'),
          trueDamage: effectiveStat(character, 'trueDamage'),
          critChance: effectiveCritChance(character),
        },
        habits: habits.map((h) => ({
          name: h.name,
          period: h.period,
          damageType: h.damageType,
          isBad: h.isBad,
          streakCount: h.streakCount,
        })),
        items: character.ownedItemIds.flatMap((id) => {
          const item = ITEM_CATALOG.find((i) => i.id === id);
          if (!item) return [];
          const factor = itemDoubleFactor(character, id);
          return [
            {
              id: item.id,
              name: item.name,
              icon: item.icon,
              equipped: character.equippedItemIds.includes(id),
              stats: describeItemBonus(item, factor),
              enchanted: factor > 1,
            },
          ];
        }),
      });

      // The fresh character is unnamed, so the new-hero screen shows next and
      // reads this to say who fell where.
      recordFallen({ name: character.name ?? DEFAULT_HERO_NAME, bossIndex: bossIndexAtDeath });
      // Quests survive a death; if any carried over, the new run starts with
      // them open (and never shows the level-2 "Quests unlocked" popup).
      characterStore.setCharacter(questStore.quests.length > 0 ? unlockQuests(deathResult.character) : deathResult.character);
      bossStore.setBoss(deathResult.boss);
      habitStore.setHabits(deathResult.habits);
    }
    dismissDeathScreen();
  }

  /**
   * Completes a quest — used both for an on-time checkbox tap (QuestSection)
   * and an "I actually did this" override from the missed-deadline gate (see
   * useQuestMissGate); the two cases resolve identically.
   *
   * Regular: grants the weekly-curve EXP for the next slot (questRewardExp, at
   * the level held right now), bumps this calendar week's completion count,
   * and resolves any level-ups. Side: grants its reward item through the item
   * drop popup and nothing else — no EXP, and the weekly count is untouched.
   * Either way it logs a quest-completed entry and removes the quest. Returns
   * what was paid out (null for an unknown id) so the caller can celebrate it.
   */
  function completeQuest(questId: string): { amount: number; item: ItemDef | null } | null {
    const quest = questStore.quests.find((q) => q.id === questId);
    if (!quest) return null;

    if (quest.kind === 'side') {
      // A side quest from before relics may promise an item that has since
      // dropped from a boss (nothing kept it out of the drop pool anymore);
      // pay an available relic instead so the deed is never unrewarded.
      const promised = quest.rewardItemId ? characterStore.grantItem(quest.rewardItemId) : null;
      const fallback = promised ? [] : availableRelics(characterStore.character, questStore.quests.filter((q) => q.id !== questId));
      const item = promised ?? (fallback.length > 0 ? characterStore.grantItem(fallback[Math.floor(rng() * fallback.length)].id) : null);
      if (item) enqueueDrops([item]);
      activityLogStore.addEntry({ kind: 'quest-completed', description: quest.description, amount: 0, itemName: item?.name });
      questStore.removeQuest(questId);
      return { amount: 0, item };
    }

    const weekKey = weeklyPeriodKey(debugClockStore.now());
    const beforeLevelUp = characterStore.character;
    const week = questWeekFor(beforeLevelUp.questWeek, weekKey);
    const amount = questRewardExp(beforeLevelUp, quest.difficulty, week.completed);
    const { character, levelsGained } = addExpAndResolveLevelUps(beforeLevelUp, amount);
    logLevelUpIfAny(beforeLevelUp, character);
    characterStore.setCharacter({ ...character, questWeek: recordQuestCompletion(beforeLevelUp.questWeek, weekKey) });
    grantEventPicks(levelsGained);

    activityLogStore.addEntry({ kind: 'quest-completed', description: quest.description, amount });
    questStore.removeQuest(questId);
    return { amount, item: null };
  }

  /**
   * Resolves a quest's missed due date (not overridden): applies
   * questMissDamage to the character, checks for death (Phoenix Feather
   * revive, same as applyPenalty), logs a quest-failed entry, and removes it
   * from the quest store. Called only from useQuestMissGate.acknowledge()
   * for a quest the player didn't flag as "I actually did this".
   */
  function failQuest(questId: string): void {
    const quest = questStore.quests.find((q) => q.id === questId);
    if (!quest) return;

    const healthBefore = characterStore.character.currentHealth;
    const amount = questMissDamage(quest, bossStore.boss, rng);
    const newHealth = Math.max(0, healthBefore - amount);
    characterStore.setCharacter({ ...characterStore.character, currentHealth: newHealth });

    activityLogStore.addEntry({ kind: 'quest-failed', description: quest.description, amount });
    questStore.removeQuest(questId);

    if (Math.round(newHealth) <= 0) {
      const reviveResult = reviveWithFeatherIfEquipped(characterStore.character);
      if (reviveResult.revived) {
        characterStore.setCharacter(reviveResult.character);
        showReviveNotice();
      } else {
        triggerDeath();
      }
    }
  }

  return {
    checkOffHabit,
    checkMissedHabit,
    checkAvoidedHabit,
    activateOverdrive,
    addHabit,
    restart,
    completeQuest,
    failQuest,
  };
}
