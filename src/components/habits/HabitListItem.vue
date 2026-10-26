<script setup lang="ts">
import { computed } from 'vue';
import { dailyPeriodKey, dayOfWeekIndex, habitDamageBreakdown, isDueOn, nextDueDay, overdriveUsesRemaining, periodKeyFor } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import { DAMAGE_TYPE_COLORS } from './damageTypeColors';
import StatIcon from '../ui/StatIcon.vue';
import { MIN_STREAK_SHOWN, streakStyleFor } from './habitDisplay';
import SkillSigil from './SkillSigil.vue';
import { WEEKDAY_SHORT } from './weekdays';

const props = defineProps<{ habit: Habit }>();
// The skill popup lives in HabitList, so it stays open when this row moves
// in or out of the Resting fold.
defineEmits<{ open: [] }>();

const { checkOffHabit, activateOverdrive } = useCombatActions();
const { enqueueDrops } = useItemDropQueue();
const debugClockStore = useDebugClockStore();
const characterStore = useCharacterStore();
const bossStore = useBossStore();
const habitStore = useHabitStore();

const currentPeriodKey = computed(() => periodKeyFor(props.habit.period, debugClockStore.now()));
const isCompletedThisPeriod = computed(() => props.habit.lastCompletedPeriodKey === currentPeriodKey.value);
// A set-day skill on one of its rest days: can't be checked or overdriven.
const isResting = computed(() => !isDueOn(props.habit, debugClockStore.now()));
const nextDayLabel = computed(() =>
  props.habit.days ? WEEKDAY_SHORT[nextDueDay(props.habit.days, dayOfWeekIndex(debugClockStore.now()))] : '',
);
// A done Overdrive skill's check stays live, haloed, until its charges are spent.
const canOverdrive = computed(
  () => !isResting.value && isCompletedThisPeriod.value && overdriveUsesRemaining(props.habit, currentPeriodKey.value) > 0,
);
const checkDisabled = computed(() => isResting.value || (isCompletedThisPeriod.value && !canOverdrive.value));

const breakdown = computed(() =>
  habitDamageBreakdown(characterStore.character, props.habit, habitStore.habits, bossStore.boss, dailyPeriodKey(debugClockStore.now())),
);

const effectiveDamage = computed(() => breakdown.value.effectiveDamage);

const damageTypeColor = computed(() => DAMAGE_TYPE_COLORS[props.habit.damageType]);

const showStreak = computed(() => props.habit.streakCount >= MIN_STREAK_SHOWN);
const streakStyle = computed(() => streakStyleFor(props.habit.streakCount));
const difficultyPips = computed(() => ({ easy: 1, medium: 2, hard: 3 })[props.habit.difficulty]);

// A Special or Ult skill's sigil travels with the name's last word, so it
// never wraps onto a line alone.
const hasSigil = computed(() => !!(props.habit.isSpecial || props.habit.isUlt));
const nameHead = computed(() => props.habit.name.slice(0, props.habit.name.lastIndexOf(' ') + 1));
const nameTail = computed(() => props.habit.name.slice(nameHead.value.length));

function onCheckOff() {
  const result = checkOffHabit(props.habit.id);
  if (result.itemsDropped.length > 0) enqueueDrops(result.itemsDropped, result.droppedBy);
}

// Tapping a haloed check overdrives the skill. Cancelling the click keeps
// the box checked, and no change event fires.
function onCheckClick(event: MouseEvent) {
  if (!canOverdrive.value) return;
  event.preventDefault();
  const result = activateOverdrive(props.habit.id);
  if (result.itemsDropped.length > 0) enqueueDrops(result.itemsDropped, result.droppedBy);
}

// The zone around the check belongs to the check while it is live, so a tap
// that misses the box doesn't open the details. Once the check is spent the
// zone is just row, and the tap opens them as before.
function onZoneClick(event: MouseEvent) {
  if (!checkDisabled.value) event.stopPropagation();
}
</script>

<template>
  <li class="habit-item" :class="{ bad: habit.isBad, resting: isResting }" :style="{ '--c': damageTypeColor }" @click="$emit('open')">
    <label class="check-zone" @click="onZoneClick">
      <input
        type="checkbox"
        class="check"
        :class="{ 'overdrive-ready': canOverdrive }"
        :aria-label="canOverdrive ? `Overdrive ${habit.name}` : `Complete ${habit.name}`"
        :checked="isCompletedThisPeriod"
        :disabled="checkDisabled"
        @click.stop="onCheckClick"
        @change="onCheckOff"
      />
    </label>
    <span v-if="hasSigil" class="name" :class="{ done: isCompletedThisPeriod }">{{ nameHead }}<span class="name-end">{{ nameTail }}<SkillSigil :habit="habit" /></span></span>
    <span v-else class="name" :class="{ done: isCompletedThisPeriod }">{{ habit.name }}</span>
    <span class="meta">
      <span v-if="isResting" class="next-day">{{ nextDayLabel }}</span>
      <span class="streak" :style="streakStyle" :title="showStreak ? `${habit.streakCount} streak` : undefined">
        <template v-if="showStreak"><StatIcon name="streak" :size="12" />{{ habit.streakCount }}</template>
      </span>
      <span class="pips" :title="habit.difficulty">
        <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= difficultyPips }" />
      </span>
    </span>
    <span class="damage">{{ effectiveDamage.toFixed(0) }}</span>
  </li>
</template>

<style scoped>
.habit-item {
  --row-pad: 0.6rem;
  --row-gap: 0.8rem;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  box-sizing: border-box;
  min-height: 44px;
  padding: var(--row-pad);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

/* The tap zone for the check: a strip down the row's left edge, out to just
   past the gap, at least 44px square. The box keeps its look. The strip is a
   pseudo-element of the label, so it anchors to the row and paints over the
   name's first pixels rather than sitting in the layout. */
.check-zone {
  display: flex;
  flex-shrink: 0;
}

.check-zone::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc(var(--row-pad) + 22px + var(--row-gap) + 0.25rem);
}

.habit-item.bad::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.45rem;
  bottom: 0.45rem;
  width: 3px;
  background: var(--damage-color);
  border-radius: 3px;
}

.habit-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

/* One neutral check color for every row — the type color lives only on the
   damage number, so a long list doesn't turn into a rainbow. */
.check {
  appearance: none;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin: 0;
  background: transparent;
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.check:hover:not(:disabled) {
  border-color: var(--accent-border);
}

.bad .check:not(:checked) {
  border-color: color-mix(in srgb, var(--damage-color) 70%, transparent);
}

.bad .check:checked {
  background: var(--damage-color);
  border-color: var(--damage-color);
}

.bad .check:hover:not(:disabled) {
  border-color: var(--damage-color);
}

.check:checked {
  background: var(--accent-solid);
  border-color: var(--accent-solid);
}

.check:checked::after {
  content: '✓';
  color: var(--bg);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

/* A spent check lets the tap fall through to the zone, which opens the details. */
.check:disabled {
  cursor: default;
  pointer-events: none;
}

/* A skill resting today: dimmed, with a hollow dashed check. */
.habit-item.resting {
  opacity: 0.45;
}

.resting .check {
  border-style: dashed;
}

/* A done Overdrive skill's check keeps a pulsing ember halo while it has
   charges left. Only the ring's opacity animates, which stays cheap. */
.check.overdrive-ready {
  position: relative;
}

.check.overdrive-ready::before {
  content: '';
  position: absolute;
  inset: -6px;
  border: 1.5px solid var(--overdrive-color);
  border-radius: 10px;
  box-shadow: 0 0 10px color-mix(in srgb, var(--overdrive-color) 55%, transparent);
  pointer-events: none;
  animation: overdrive-halo 2.4s ease-in-out infinite;
}

@keyframes overdrive-halo {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .check.overdrive-ready::before {
    animation: none;
  }
}

.check:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.name {
  flex: 1;
  min-width: 0;
  text-align: left;
  color: var(--text-h);
  overflow-wrap: break-word;
}

.name.done {
  text-decoration: line-through;
  color: var(--text);
  opacity: 0.6;
}

/* One unit, so the last word and its sigil wrap together. Text decoration
   doesn't reach into inline blocks, hence the explicit strike-through. */
.name-end {
  display: inline-block;
}

.name.done .name-end {
  text-decoration: inherit;
}

.sigil {
  margin-left: 0.4em;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  font-size: 0.75rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.streak {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  min-width: 3.5rem;
}

.pips {
  display: flex;
  gap: 0.2rem;
}

.next-day {
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.7rem;
}

.pip {
  width: 6px;
  height: 6px;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--accent);
}

.damage {
  flex-shrink: 0;
  width: 3rem;
  text-align: right;
  color: var(--c);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 560px) {
  .habit-item {
    --row-gap: 0.6rem;
  }

  .meta {
    gap: 0.5rem;
  }

  .damage {
    width: 2.5rem;
  }
}
</style>
