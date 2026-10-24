<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import type { EventId } from '../../game-engine';
import { useEventChoice } from '../../composables/useEventChoice';
import { useModalPriority } from '../../composables/useModalPriority';
import { TUNING } from '../../game-engine/constants/tuning';
import { useHabitStore } from '../../store/habitStore';
import RerollSkillRow from '../habits/RerollSkillRow.vue';
import { sortByDamageType } from '../habits/habitDisplay';
import QuestForm from '../quests/QuestForm.vue';
import ItemHero from '../ui/ItemHero.vue';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import { EVENT_ICON } from '../ui/statIcons';

const { pending, choices, revealed, ensureChoices, choose, chooseReroll, chooseSideQuest, dismissReveal } = useEventChoice();
const { eventChoiceVisible } = useModalPriority();
const habitStore = useHabitStore();

watchEffect(ensureChoices);

const step = ref<'choose' | 'reroll' | 'quest'>('choose');
watch(choices, () => {
  step.value = 'choose';
});

// Reroll step: tap a row to pick it, then confirm.
const rerollPickId = ref<string | null>(null);
const dailyHabits = computed(() => sortByDamageType(habitStore.habits.filter((habit) => habit.period === 'daily')));
const weeklyHabits = computed(() => sortByDamageType(habitStore.habits.filter((habit) => habit.period === 'weekly')));
const rerollPick = computed(() => habitStore.habits.find((habit) => habit.id === rerollPickId.value));

function togglePick(id: string) {
  rerollPickId.value = rerollPickId.value === id ? null : id;
}

function confirmReroll() {
  if (!rerollPick.value) return;
  chooseReroll(rerollPick.value.id);
  rerollPickId.value = null;
}

const enchantFactor = TUNING.DOUBLED_ITEM_MULTIPLIER;

const subtitle = computed(() => {
  if (revealed.value) return '';
  if (step.value === 'reroll') return 'Pick a skill to re-roll. Its damage type changes; nothing else does.';
  if (step.value === 'quest') return 'Name your deed';
  return pending.value > 1 ? `Choose 1 event · ${pending.value} picks waiting` : 'Choose 1 event';
});

function onPick(id: EventId) {
  if (id === 'side-quest') step.value = 'quest';
  else if (id === 'reroll-skill') {
    rerollPickId.value = null;
    step.value = 'reroll';
  }
  else choose(id);
}
</script>

<template>
  <Modal :model-value="eventChoiceVisible" :dismissible="false" :title="revealed ? 'Enchanted!' : 'Level up!'" max-width="640px">
    <template v-if="revealed">
      <ItemHero :item="revealed" :factor="enchantFactor" />
      <button type="button" class="ok primary-button" @click="dismissReveal">Nice!</button>
    </template>

    <template v-else>
    <p class="subtitle">{{ subtitle }}</p>

    <div v-if="step === 'choose'" class="cards">
      <button v-for="event in choices" :key="event.id" type="button" class="card" @click="onPick(event.id)">
        <StatIcon :name="EVENT_ICON[event.id]" :size="34" class="icon" />
        <strong class="card-title">{{ event.title }}</strong>
        <span v-if="event.description" class="card-desc">{{ event.description }}</span>
        <span v-if="event.oneTime" class="badge">One-time</span>
      </button>
    </div>

    <template v-else-if="step === 'reroll'">
      <div v-for="group in [{ label: 'Daily', habits: dailyHabits }, { label: 'Weekly', habits: weeklyHabits }]" :key="group.label" class="habit-group">
        <template v-if="group.habits.length">
          <h3 class="habit-group-title">{{ group.label }}</h3>
          <ul class="reroll-list">
            <RerollSkillRow
              v-for="habit in group.habits"
              :key="habit.id"
              :habit="habit"
              :selected="habit.id === rerollPickId"
              @pick="togglePick(habit.id)"
            />
          </ul>
        </template>
      </div>
      <button type="button" class="ok primary-button" :disabled="!rerollPick" @click="confirmReroll">
        {{ rerollPick ? `Reroll ${rerollPick.name}` : 'Pick a skill' }}
      </button>
      <button type="button" class="back" @click="step = 'choose'">← Back</button>
    </template>

    <template v-else>
      <QuestForm kind="side" @submit="chooseSideQuest" />
      <button type="button" class="back" @click="step = 'choose'">← Back</button>
    </template>
    </template>
  </Modal>
</template>

<style scoped>
.subtitle {
  margin: 0 0 1rem;
  color: var(--text);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 0.75rem 1rem;
  text-align: center;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: transform 0.15s, border-color 0.15s, background-color 0.15s;
}

.card:hover,
.card:focus-visible {
  transform: translateY(-3px);
  border-color: var(--accent);
  background: var(--accent-bg);
}

.icon {
  margin-bottom: 0.15rem;
}

.card-title {
  color: var(--text-h);
  font-size: 1.05rem;
}

.card-desc {
  color: var(--text);
  font-size: 0.85rem;
  line-height: 1.4;
}

.badge {
  margin-top: auto;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  color: var(--accent);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.habit-group {
  margin-top: 0.75rem;
}

.reroll-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ok {
  display: block;
  width: 100%;
  margin-top: 0.75rem;
}

.back {
  margin-top: 0.75rem;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-h);
}
</style>
