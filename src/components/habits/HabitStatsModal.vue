<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  computeDamageSplit,
  DAMAGE_TYPE_STARTER_STAT,
  effectiveStat,
  levelRewardMultiplier,
  overdriveDamagePreview,
  overdriveUsesRemaining,
  periodKeyFor,
  periodRewardMultiplier,
  streakMultiplier,
} from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; habit: Habit }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();
const habitStore = useHabitStore();
const debugClockStore = useDebugClockStore();
const { activateOverdrive } = useCombatActions();
const { enqueueDrops } = useItemDropQueue();

const baseDamage = computed(() => {
  const character = characterStore.character;
  const statField = DAMAGE_TYPE_STARTER_STAT[props.habit.damageType];
  const statValue = effectiveStat(character, statField);
  const siblings = habitStore.habitsOfType(props.habit.damageType, props.habit.isBad);
  const split = computeDamageSplit(siblings, statValue);
  return split.get(props.habit.id) ?? 0;
});

const multiplier = computed(() => streakMultiplier(props.habit.streakCount, props.habit.period));
const periodMultiplier = computed(() => periodRewardMultiplier(props.habit.period));
const bonusMultiplier = computed(() => levelRewardMultiplier(props.habit));
const effectiveDamage = computed(
  () => baseDamage.value * multiplier.value * periodMultiplier.value * bonusMultiplier.value,
);
const rewardTag = computed(() => (props.habit.isSpecial ? 'Special' : props.habit.isUlt ? 'Ult' : null));
const overdriveDamage = computed(() =>
  overdriveDamagePreview(baseDamage.value * multiplier.value * periodMultiplier.value),
);

const currentPeriodKey = computed(() => periodKeyFor(props.habit.period, debugClockStore.now()));
const isCompletedThisPeriod = computed(() => props.habit.lastCompletedPeriodKey === currentPeriodKey.value);
const overdriveRemaining = computed(() => overdriveUsesRemaining(props.habit, currentPeriodKey.value));
const canOverdrive = computed(() => isCompletedThisPeriod.value && overdriveRemaining.value > 0);

function onOverdrive() {
  const itemsDropped = activateOverdrive(props.habit.id);
  if (itemsDropped.length > 0) enqueueDrops(itemsDropped);
}

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

      <template v-if="rewardTag">
        <dt>Bonus</dt>
        <dd><span class="tag">{{ rewardTag }}</span> ×{{ bonusMultiplier.toFixed(2) }} (first use only)</dd>
      </template>

      <dt>{{ habit.isBad ? 'Base reward if avoided' : 'Base damage' }}</dt>
      <dd>{{ baseDamage.toFixed(2) }}</dd>

      <dt>{{ habit.isBad ? 'Effective reward if avoided' : 'Effective damage' }}</dt>
      <dd>{{ effectiveDamage.toFixed(2) }}</dd>
    </dl>

    <div v-if="habit.isOverdrive" class="overdrive-section">
      <button type="button" class="overdrive-button" :disabled="!canOverdrive" @click="onOverdrive">
        Overdrive ({{ overdriveRemaining }} left) — {{ overdriveDamage.toFixed(2) }} dmg
      </button>
    </div>

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

.tag {
  background: #16a34a;
  color: white;
  font-size: 0.8em;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.overdrive-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.overdrive-button {
  width: 100%;
  background: #dc2626;
  color: white;
  border: none;
}

.overdrive-button:disabled {
  background: var(--border);
  color: var(--text);
  opacity: 0.6;
  cursor: not-allowed;
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
