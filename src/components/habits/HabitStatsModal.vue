<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  dailyPeriodKey,
  formatCompact,
  habitDamageBreakdown,
  hasItemEffect,
  isDueOn,
  nextRankMilestone,
  overdriveDamagePreview,
  overdriveUsesRemaining,
  periodKeyFor,
  removalLocked,
} from '../../game-engine';
import type { DamageType, Habit } from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import { useCombatActions } from '../../composables/useCombatActions';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import type { StatIconName } from '../ui/statIcons';
import { DAMAGE_TYPE_COLORS } from './damageTypeColors';
import DayPicker from './DayPicker.vue';
import { rankNumeral } from './habitDisplay';
import RankDiamonds from './RankDiamonds.vue';
import SkillSigil from './SkillSigil.vue';
import { ALL_DAYS, dayCountLabel } from './weekdays';

const props = defineProps<{ modelValue: boolean; habit: Habit }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();
const bossStore = useBossStore();
const habitStore = useHabitStore();
const debugClockStore = useDebugClockStore();
const { activateOverdrive } = useCombatActions();
const { enqueueDrops } = useItemDropQueue();

const breakdown = computed(() =>
  habitDamageBreakdown(characterStore.character, props.habit, habitStore.habits, bossStore.boss, dailyPeriodKey(debugClockStore.now())),
);

const baseDamage = computed(() => breakdown.value.baseDamage);
const itemMultiplier = computed(() => breakdown.value.itemMultiplier);
const multiplier = computed(() => breakdown.value.rankMultiplier);
const crowded = computed(() => breakdown.value.crowded);
const weeklyMultiplier = computed(() => breakdown.value.weeklyMultiplier);
const bonusMultiplier = computed(() => breakdown.value.bonusMultiplier);
const effectMultiplier = computed(() => breakdown.value.effectMultiplier);
const effectiveDamage = computed(() => breakdown.value.effectiveDamage);
const DAMAGE_TYPES: Record<DamageType, { label: string; icon: StatIconName }> = {
  physical: { label: 'Physical', icon: 'physical' },
  magic: { label: 'Magic', icon: 'magic' },
  healing: { label: 'Healing', icon: 'healing' },
  trueDamage: { label: 'True damage', icon: 'true' },
};
const damageType = computed(() => DAMAGE_TYPES[props.habit.damageType]);
const damageColor = computed(() => DAMAGE_TYPE_COLORS[props.habit.damageType]);
const periodLabel = computed(() => (props.habit.period === 'weekly' ? 'Weekly' : 'Daily'));
const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

// The rank block: the rank, its diamonds, and the streak's way to the next
// one. A weekly counts weeks.
const rank = computed(() => props.habit.rank ?? 0);
const nextMilestone = computed(() => nextRankMilestone(rank.value, props.habit.period));
const unit = computed(() => (props.habit.period === 'weekly' ? ' wk' : ''));
const rankBarPct = computed(() =>
  nextMilestone.value === undefined ? 100 : Math.min(100, (props.habit.streakCount * 100) / nextMilestone.value),
);

// The hit, worked out top to bottom: the base, then each multiplier that
// changes it. Gear only shows once items boost this damage type. Rank and
// streak add into one multiplier (see rankMultiplier), so the streak row is
// what it adds on top of the rank row: the rows multiply out to the real hit.
const multipliers = computed(() => {
  const rankFactor = 1 + breakdown.value.rankBonus;
  const rows: { label: string; icon: StatIconName; note?: string; text: string }[] = [
    { label: 'Rank', icon: 'levelUp', note: rankNumeral(rank.value), text: rank.value ? formatMultiplier(rankFactor) : '—' },
    { label: 'Streak', icon: 'streak', note: String(props.habit.streakCount), text: formatMultiplier(multiplier.value / rankFactor) },
  ];
  if (itemMultiplier.value !== 1) rows.push({ label: 'Gear', icon: 'gear', text: formatMultiplier(itemMultiplier.value) });
  if (effectMultiplier.value !== 1) rows.push({ label: 'Effects', icon: 'itemDoubled', text: formatMultiplier(effectMultiplier.value) });
  if (props.habit.period === 'weekly') rows.push({ label: 'Weekly', icon: 'weekly', text: formatMultiplier(weeklyMultiplier.value) });
  return rows;
});
const bonusLabel = computed(() => (props.habit.isSpecial ? 'Special' : props.habit.isUlt ? 'Ult' : null));
const totalLabel = computed(() =>
  props.habit.isBad ? 'If resisted' : props.habit.damageType === 'healing' ? 'Heals for' : 'Strikes for',
);
/** ×2.20 → ×2.2, ×2.00 → ×2.0 */
function formatMultiplier(value: number): string {
  return `×${value.toFixed(2).replace(/0$/, '')}`;
}
// Overdrive never gets the Special/Ult bonus, so its preview excludes
// bonusMultiplier, but still gets the rank, weekly bonus and item effects like
// any other use (and full damage with Dynamo Core).
const overdriveDamage = computed(() => {
  const full = baseDamage.value * itemMultiplier.value * multiplier.value * weeklyMultiplier.value * effectMultiplier.value;
  return hasItemEffect(characterStore.character, 'dynamo') ? full : overdriveDamagePreview(full);
});

const currentPeriodKey = computed(() => periodKeyFor(props.habit.period, debugClockStore.now()));
const isCompletedThisPeriod = computed(() => props.habit.lastCompletedPeriodKey === currentPeriodKey.value);
// A set-day skill on a rest day: the hit dims and Overdrive can't be used.
const isResting = computed(() => !isDueOn(props.habit, debugClockStore.now()));
const overdriveRemaining = computed(() => overdriveUsesRemaining(props.habit, currentPeriodKey.value));
const canOverdrive = computed(() => !isResting.value && isCompletedThisPeriod.value && overdriveRemaining.value > 0);

// A daily's days are changed right here; each tap saves.
function onDaysChange(days: number[]) {
  habitStore.setHabitDays(props.habit.id, days);
}
// Each charge is dim until the skill lands, lit while it can be used, and
// greyed once spent.
function chargeState(n: number): 'used' | 'ready' | undefined {
  if (n <= TUNING.OVERDRIVE_MAX_EXTRA_USES - overdriveRemaining.value) return 'used';
  return isCompletedThisPeriod.value ? 'ready' : undefined;
}

function onOverdrive() {
  const result = activateOverdrive(props.habit.id);
  if (result.itemsDropped.length > 0) enqueueDrops(result.itemsDropped, result.droppedBy);
}

// Two-tap confirm: the first click just reveals the "really remove?" state,
// so a single accidental tap on the row never deletes a habit. A skill added
// today can't be removed until tomorrow.
const confirmingRemove = ref(false);
const removeLocked = computed(() => removalLocked(props.habit, dailyPeriodKey(debugClockStore.now())));
watch(
  () => props.modelValue,
  (open) => {
    if (!open) confirmingRemove.value = false;
  },
);

function removeHabit() {
  habitStore.removeHabit(props.habit.id);
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="habit.name"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <p class="skill-meta">
      <StatIcon :name="damageType.icon" />
      <span>{{ damageType.label }}</span>
      <template v-if="habit.period === 'weekly'">
        <span aria-hidden="true">·</span>
        <span>{{ periodLabel }}</span>
      </template>
      <span aria-hidden="true">·</span>
      <span>{{ DIFFICULTY_LABELS[habit.difficulty] }}</span>
    </p>

    <div class="rank-block">
      <div class="rank-top">
        <span class="rank-label">{{ rank ? `Rank ${rankNumeral(rank)}` : 'Unranked' }}</span>
        <RankDiamonds :rank="rank" />
      </div>
      <div class="rank-bar"><i :style="{ width: `${rankBarPct}%` }" /></div>
      <div class="rank-caption">
        <span>{{ habit.streakCount }}{{ unit }}</span>
        <span v-if="nextMilestone !== undefined"><b>{{ rankNumeral(rank + 1) }}</b> at {{ nextMilestone }}{{ unit }}</span>
      </div>
    </div>

    <div v-if="habit.period === 'daily'" class="skill-days">
      <div class="skill-days-label">
        <span>Days</span>
        <span>{{ dayCountLabel(habit.days) }}</span>
      </div>
      <DayPicker :model-value="habit.days ?? ALL_DAYS" @update:model-value="onDaysChange" />
    </div>

    <dl class="skill-sum" :class="{ resting: isResting }">
      <div class="sum-row base" :class="{ crowded }">
        <dt>Base<small v-if="crowded" class="crowded">crowded</small></dt>
        <dd>{{ formatCompact(baseDamage) }}</dd>
      </div>
      <div v-for="row in multipliers" :key="row.label" class="sum-row">
        <dt><StatIcon :name="row.icon" />{{ row.label }}<small v-if="row.note">{{ row.note }}</small></dt>
        <dd>{{ row.text }}</dd>
      </div>
      <div v-if="bonusLabel" class="sum-row">
        <dt><SkillSigil :habit="habit" :size="14" />{{ bonusLabel }}</dt>
        <dd>{{ formatMultiplier(bonusMultiplier) }}</dd>
      </div>
      <div class="sum-total" :style="{ '--c': damageColor }">
        <dt>{{ totalLabel }}</dt>
        <dd>{{ formatCompact(effectiveDamage) }}</dd>
      </div>
    </dl>

    <button
      v-if="habit.isOverdrive"
      type="button"
      class="overdrive-button"
      :class="{ ready: canOverdrive }"
      :aria-label="`Overdrive, ${overdriveRemaining} left, ${overdriveDamage.toFixed(0)}`"
      :disabled="!canOverdrive"
      @click="onOverdrive"
    >
      Overdrive
      <span class="charges" aria-hidden="true">
        <span v-for="n in TUNING.OVERDRIVE_MAX_EXTRA_USES" :key="n" class="charge" :class="chargeState(n)" />
      </span>
      <small>{{ formatCompact(overdriveDamage) }}</small>
    </button>

    <div class="remove-section">
      <button
        v-if="!confirmingRemove"
        type="button"
        class="remove-button"
        :class="{ locked: removeLocked }"
        :disabled="removeLocked"
        @click="confirmingRemove = true"
      >
        Remove habit
        <small v-if="removeLocked">Tomorrow</small>
      </button>
      <template v-else>
        <span class="confirm-text">Remove "{{ habit.name }}" for good?</span>
        <div class="confirm-actions">
          <button type="button" class="confirm-remove-button" @click="removeHabit">Yes, remove it</button>
          <button type="button" class="cancel-button" @click="confirmingRemove = false">Cancel</button>
        </div>
      </template>
    </div>
  </Modal>
</template>

<style scoped>
.skill-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  color: var(--text);
  font-size: 0.85rem;
}

.rank-block {
  margin: 0 0 1rem;
}

.rank-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}

.rank-label {
  color: var(--text-h);
  font-size: 0.8rem;
  font-weight: 600;
}

.rank-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.rank-bar i {
  display: block;
  height: 100%;
  background: var(--accent);
}

.rank-caption {
  display: flex;
  justify-content: space-between;
  margin-top: 0.25rem;
  color: var(--text);
  font-size: 0.8rem;
}

.rank-caption b {
  color: var(--accent);
}

.skill-sum {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.sum-row,
.sum-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.skill-sum dt {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  color: var(--text-h);
}

.skill-sum dt small {
  color: var(--text);
  font-size: 0.8em;
  font-weight: 400;
}

.skill-sum dd {
  margin: 0;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.sum-row.base dd {
  color: var(--text-h);
}

.sum-row.base.crowded dd {
  color: var(--text);
}

.sum-total {
  margin-top: 0.25rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}

.sum-total dt {
  color: var(--text);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sum-total dd {
  color: var(--c);
  font-size: 1.6rem;
  font-weight: 700;
}

.skill-sum.resting .sum-total dd {
  opacity: 0.45;
  text-shadow: none;
}

.skill-days {
  margin: 0 0 1rem;
}

.skill-days-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.4rem;
  color: var(--text);
  font-size: 0.8rem;
}

.overdrive-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  margin-top: 1rem;
  background: var(--overdrive-color);
  color: white;
  border: none;
}

.overdrive-button small {
  font-weight: 400;
  opacity: 0.85;
}

.charges {
  display: inline-flex;
  gap: 0.3rem;
}

.charge {
  width: 7px;
  height: 7px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.6;
}

.charge.ready {
  background: currentColor;
  opacity: 1;
}

.charge.used {
  opacity: 0.35;
}

/* While it has charges to spend the button pulses, like the check's halo:
   a glow layer whose opacity animates. */
.overdrive-button.ready::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 14px 2px color-mix(in srgb, var(--overdrive-color) 60%, transparent);
  pointer-events: none;
  animation: overdrive-pulse 2.4s ease-in-out infinite;
}

@keyframes overdrive-pulse {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .overdrive-button.ready::after {
    animation: none;
  }
}

.overdrive-button:disabled {
  background: var(--border);
  color: var(--text);
  opacity: 0.6;
  cursor: not-allowed;
}

.remove-section {
  margin-top: 0.75rem;
  text-align: center;
}

.remove-button {
  padding: 0.4rem 0.6rem;
  color: #dc2626;
  background: transparent;
  border: none;
  font-size: 0.8rem;
}

.remove-button.locked {
  color: var(--text);
  cursor: not-allowed;
}

.remove-button small {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.85em;
}

.confirm-text {
  display: block;
  margin-bottom: 0.5rem;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.confirm-remove-button {
  background: #dc2626;
  color: white;
  border: none;
}
</style>
