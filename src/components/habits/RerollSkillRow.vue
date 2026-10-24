<script setup lang="ts">
import { computed } from 'vue';
import { dailyPeriodKey, habitDamageBreakdown } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import StatIcon from '../ui/StatIcon.vue';
import { DAMAGE_TYPE_COLORS } from './damageTypeColors';
import { MIN_STREAK_SHOWN, streakStyleFor } from './habitDisplay';
import SkillSigil from './SkillSigil.vue';

// A skill row for the Reroll popup: the main list's row (name, sigil, streak,
// difficulty pips, damage), but a pick marker where the check would be.
const props = defineProps<{ habit: Habit; selected: boolean }>();
defineEmits<{ pick: [] }>();

const characterStore = useCharacterStore();
const bossStore = useBossStore();
const habitStore = useHabitStore();
const debugClockStore = useDebugClockStore();

const effectiveDamage = computed(() => {
  const siblings = habitStore.habitsOfType(props.habit.damageType, props.habit.period);
  return habitDamageBreakdown(characterStore.character, props.habit, siblings, bossStore.boss, dailyPeriodKey(debugClockStore.now()))
    .effectiveDamage;
});

const showStreak = computed(() => props.habit.streakCount >= MIN_STREAK_SHOWN);
const difficultyPips = computed(() => ({ easy: 1, medium: 2, hard: 3 })[props.habit.difficulty]);
const hasSigil = computed(() => !!(props.habit.isSpecial || props.habit.isUlt));
const nameHead = computed(() => props.habit.name.slice(0, props.habit.name.lastIndexOf(' ') + 1));
const nameTail = computed(() => props.habit.name.slice(nameHead.value.length));
</script>

<template>
  <li>
    <button
      type="button"
      class="habit-item reroll-row"
      :class="{ bad: habit.isBad, selected }"
      :style="{ '--c': DAMAGE_TYPE_COLORS[habit.damageType] }"
      :aria-pressed="selected"
      @click="$emit('pick')"
    >
      <span class="pick"><i /></span>
      <span v-if="hasSigil" class="name">{{ nameHead }}<span class="name-end">{{ nameTail }}<SkillSigil :habit="habit" /></span></span>
      <span v-else class="name">{{ habit.name }}</span>
      <span class="meta">
        <span class="streak" :style="streakStyleFor(habit.streakCount)">
          <template v-if="showStreak"><StatIcon name="streak" :size="12" />{{ habit.streakCount }}</template>
        </span>
        <span class="pips" :title="habit.difficulty">
          <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= difficultyPips }" />
        </span>
      </span>
      <span class="damage">{{ effectiveDamage.toFixed(0) }}</span>
    </button>
  </li>
</template>

<style scoped>
.reroll-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  min-height: 44px;
  padding: 0.6rem;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
}

.reroll-row.selected {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

/* Where the main list has its check. */
.pick {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
}

.pick i {
  width: 9px;
  height: 9px;
  transform: rotate(45deg);
  border: 1px solid var(--border);
  transition: all 0.2s;
}

.selected .pick i {
  width: 11px;
  height: 11px;
  background: var(--accent-solid);
  border-color: var(--accent);
  box-shadow: 0 0 12px 1px color-mix(in srgb, var(--accent-solid) 55%, transparent);
}

.name {
  flex: 1;
  min-width: 0;
  color: var(--text-h);
  overflow-wrap: break-word;
}

.name-end {
  display: inline-block;
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
  .reroll-row {
    gap: 0.6rem;
  }

  .meta {
    gap: 0.5rem;
  }

  .damage {
    width: 2.5rem;
  }
}
</style>
