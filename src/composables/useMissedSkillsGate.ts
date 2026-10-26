// Small shared (module-scoped) queue of habit outcomes detected during the
// last daily/weekly rollover — same singleton reasoning as `useDeathScreen`:
// the code that detects them (`useDailyRollover`) and the component that
// renders the blocking popup (`MissedSkillsPopup`, mounted once in
// `AppShell`) must see the same state.
//
// Two outcome kinds share this one queue: `queueMiss` (a good habit not
// completed — penalty) and `queueReward` (a bad habit not checked, i.e.
// avoided — reward). See `useDailyRollover` for which one fires per habit.
//
// Detection and resolution are deliberately split: queuing only records the
// outcome — it never touches character/boss health. The actual
// damage/healing (and the floating damage-popup animation it drives) is
// applied by `acknowledge()`, once the player has seen the list and clicked
// OK, so it never happens off-screen before the popup shows. Each queued
// item's `lastCheckedPeriodKey` stamp is deferred the same way: it's
// written by `acknowledge()`, not at detection time, so an outcome that's
// queued but never acknowledged (app closed before the popup is dismissed)
// is detected again next launch instead of silently skipped.
//
// Detection can be wrong: a habit only reads as missed/avoided because the
// player forgot to tap its checkbox, not because they actually skipped it.
// `overridden` tracks which pending habit IDs the player has flagged (via
// the popup's checkboxes) as "I actually did this" — `acknowledge()` flips
// that item's outcome (penalty <-> reward) before resolving it, rather than
// trusting the rollover's detected outcome blindly.

import { computed, ref } from 'vue';
import type { Difficulty, Habit, Period } from '../game-engine';
import { useCombatActions } from './useCombatActions';
import { useHabitStore } from '../store/habitStore';
import { useItemDropQueue } from './useItemDropQueue';

interface PendingOutcome {
  habitId: string;
  habitName: string;
  difficulty: Difficulty;
  period: Period;
  periodKeyToStamp: string;
  outcome: 'penalty' | 'reward';
}

const pending = ref<PendingOutcome[]>([]);
const overridden = ref<Set<string>>(new Set());

export function useMissedSkillsGate() {
  const habitStore = useHabitStore();
  const { checkMissedHabit, checkAvoidedHabit, landDoom } = useCombatActions();
  const { enqueueDrops } = useItemDropQueue();

  const misses = computed(() => pending.value.filter((item) => item.outcome === 'penalty'));
  const rewards = computed(() => pending.value.filter((item) => item.outcome === 'reward'));
  const hasPending = computed(() => pending.value.length > 0);

  /** Whether `habitId` is currently flagged as "I actually did this" (its outcome will be flipped on acknowledge). */
  function isOverridden(habitId: string): boolean {
    return overridden.value.has(habitId);
  }

  /** Toggles the "I actually did this" flag for `habitId`. */
  function toggleOverride(habitId: string): void {
    const next = new Set(overridden.value);
    if (next.has(habitId)) next.delete(habitId);
    else next.add(habitId);
    overridden.value = next;
  }

  /** Whether `habitId` is already queued — the rollover can run again while its popup is still up, and a habit isn't stamped until acknowledged. */
  function isPending(habitId: string): boolean {
    return pending.value.some((item) => item.habitId === habitId);
  }

  /** Records a good-habit miss for `habit`, stamping `periodKeyToStamp` once acknowledged. */
  function queueMiss(habit: Habit, periodKeyToStamp: string) {
    if (isPending(habit.id)) return;
    pending.value.push({
      habitId: habit.id,
      habitName: habit.name,
      difficulty: habit.difficulty,
      period: habit.period,
      periodKeyToStamp,
      outcome: 'penalty',
    });
  }

  /** Records a bad-habit avoidance reward for `habit`, stamping `periodKeyToStamp` once acknowledged. */
  function queueReward(habit: Habit, periodKeyToStamp: string) {
    if (isPending(habit.id)) return;
    pending.value.push({
      habitId: habit.id,
      habitName: habit.name,
      difficulty: habit.difficulty,
      period: habit.period,
      periodKeyToStamp,
      outcome: 'reward',
    });
  }

  /**
   * Applies every queued outcome (penalty via `checkMissedHabit`, reward via
   * `checkAvoidedHabit` — enqueuing any items a reward's boss-kill drops)
   * and stamps its deferred `lastCheckedPeriodKey`, then clears the queue and
   * lands any Doom that's due.
   * An item flagged via `toggleOverride` resolves as the *opposite* outcome
   * from the one detected — the player is correcting a habit they forgot to
   * check off rather than actually missing/avoiding it.
   */
  function acknowledge() {
    for (const item of pending.value) {
      const effectiveOutcome: PendingOutcome['outcome'] = overridden.value.has(item.habitId)
        ? item.outcome === 'penalty' ? 'reward' : 'penalty'
        : item.outcome;

      if (effectiveOutcome === 'penalty') {
        checkMissedHabit(item.habitId);
      } else {
        const result = checkAvoidedHabit(item.habitId);
        if (result.itemsDropped.length > 0) enqueueDrops(result.itemsDropped, result.droppedBy);
      }
      const habit = habitStore.habits.find((h) => h.id === item.habitId);
      if (habit) {
        habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: item.periodKeyToStamp });
      }
    }
    pending.value = [];
    overridden.value = new Set();
    // Last, so the day's misses and avoided habits land first (and a boss
    // they kill takes its Doom with it).
    landDoom();
  }

  return { misses, rewards, hasPending, queueMiss, queueReward, isOverridden, toggleOverride, acknowledge };
}
