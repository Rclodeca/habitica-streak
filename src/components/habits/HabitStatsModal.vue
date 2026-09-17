<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { computeDamageSplit, DAMAGE_TYPE_STARTER_STAT, effectiveStat, streakMultiplier } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import { useHabitStore } from '../../store/habitStore';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; habit: Habit }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();
const habitStore = useHabitStore();

const baseDamage = computed(() => {
  const character = characterStore.character;
  const statField = DAMAGE_TYPE_STARTER_STAT[props.habit.damageType];
  const statValue = effectiveStat(character, statField);
  const siblings = habitStore.habitsOfType(props.habit.damageType, props.habit.isBad);
  const split = computeDamageSplit(siblings, statValue);
  return split.get(props.habit.id) ?? 0;
});

const multiplier = computed(() => streakMultiplier(props.habit.streakCount));
const effectiveDamage = computed(() => baseDamage.value * multiplier.value);

// Two-tap confirm: the first click just reveals the "really remove?" state,
// so a single accidental tap on the row never deletes a habit.
const confirmingRemove = ref(false);
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
    <dl class="stat-list">
      <dt>Type</dt>
      <dd>{{ habit.isBad ? 'Bad Habit' : 'Good Habit' }}</dd>

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

      <dt>{{ habit.isBad ? 'Base reward if avoided' : 'Base damage' }}</dt>
      <dd>{{ baseDamage.toFixed(2) }}</dd>

      <dt>{{ habit.isBad ? 'Effective reward if avoided' : 'Effective damage' }}</dt>
      <dd>{{ effectiveDamage.toFixed(2) }}</dd>
    </dl>

    <div class="remove-section">
      <button v-if="!confirmingRemove" type="button" class="remove-button" @click="confirmingRemove = true">
        Remove habit
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

.remove-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.remove-button {
  color: #dc2626;
  background: transparent;
  border: 1px solid rgba(220, 38, 38, 0.4);
}

.confirm-text {
  display: block;
  margin-bottom: 0.5rem;
}

.confirm-actions {
  display: flex;
  gap: 0.5rem;
}

.confirm-remove-button {
  background: #dc2626;
  color: white;
  border: none;
}
</style>
