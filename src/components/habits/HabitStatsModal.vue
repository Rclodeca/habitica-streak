<script setup lang="ts">
import { computed } from 'vue';
import { computeDamageSplit, DAMAGE_TYPE_STARTER_STAT, statAtLevel, streakMultiplier } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import { useHabitStore } from '../../store/habitStore';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; habit: Habit }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();
const habitStore = useHabitStore();

const baseDamage = computed(() => {
  const character = characterStore.character;
  const statField = DAMAGE_TYPE_STARTER_STAT[props.habit.damageType];
  const statValue = statAtLevel(character.starterStats[statField], character.level);
  const siblings = habitStore.habitsOfType(props.habit.damageType);
  const split = computeDamageSplit(siblings, statValue);
  return split.get(props.habit.id) ?? 0;
});

const multiplier = computed(() => streakMultiplier(props.habit.streakCount));
const effectiveDamage = computed(() => baseDamage.value * multiplier.value);
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="habit.name"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <dl class="stat-list">
      <dt>Period</dt>
      <dd>{{ habit.period }}</dd>

      <dt>Difficulty</dt>
      <dd>{{ habit.difficulty }}</dd>

      <dt>Damage type</dt>
      <dd>{{ habit.damageType }}</dd>

      <dt>Streak</dt>
      <dd>{{ habit.streakCount }}</dd>

      <dt>Streak multiplier</dt>
      <dd>×{{ multiplier.toFixed(2) }}</dd>

      <dt>Base damage</dt>
      <dd>{{ baseDamage.toFixed(2) }}</dd>

      <dt>Effective damage</dt>
      <dd>{{ effectiveDamage.toFixed(2) }}</dd>
    </dl>
  </Modal>
</template>

<style scoped>
.stat-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1rem;
  margin: 0;
}

.stat-list dt {
  font-weight: 600;
  color: var(--text-h);
}

.stat-list dd {
  margin: 0;
  text-align: right;
}
</style>
