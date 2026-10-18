<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import type { EventId } from '../../game-engine';
import { useEventChoice } from '../../composables/useEventChoice';
import { useModalPriority } from '../../composables/useModalPriority';
import { TUNING } from '../../game-engine/constants/tuning';
import { useHabitStore } from '../../store/habitStore';
import QuestForm from '../quests/QuestForm.vue';
import ItemHero from '../ui/ItemHero.vue';
import Modal from '../ui/Modal.vue';

const { pending, choices, revealed, ensureChoices, choose, chooseReroll, chooseQuest, dismissReveal } = useEventChoice();
const { eventChoiceVisible } = useModalPriority();
const habitStore = useHabitStore();

watchEffect(ensureChoices);

const step = ref<'choose' | 'reroll' | 'quest'>('choose');
watch(choices, () => {
  step.value = 'choose';
});

const enchantFactor = TUNING.DOUBLED_ITEM_MULTIPLIER;

const subtitle = computed(() => {
  if (revealed.value) return '';
  if (step.value === 'reroll') return 'Pick a skill to re-roll';
  if (step.value === 'quest') return 'Describe your quest';
  return pending.value > 1 ? `Choose 1 event · ${pending.value} picks waiting` : 'Choose 1 event';
});

function onPick(id: EventId) {
  if (id === 'quest') step.value = 'quest';
  else if (id === 'reroll-skill') step.value = 'reroll';
  else choose(id);
}
</script>

<template>
  <Modal :model-value="eventChoiceVisible" :dismissible="false" :title="revealed ? 'Enchanted!' : 'Level up!'" max-width="640px">
    <template v-if="revealed">
      <ItemHero :item="revealed" :factor="enchantFactor" />
      <button type="button" class="ok" @click="dismissReveal">Nice!</button>
    </template>

    <template v-else>
    <p class="subtitle">{{ subtitle }}</p>

    <div v-if="step === 'choose'" class="cards">
      <button v-for="event in choices" :key="event.id" type="button" class="card" @click="onPick(event.id)">
        <span class="icon" aria-hidden="true">{{ event.icon }}</span>
        <strong class="card-title">{{ event.title }}</strong>
        <span v-if="event.description" class="card-desc">{{ event.description }}</span>
        <span v-if="event.oneTime" class="badge">One-time</span>
      </button>
    </div>

    <template v-else-if="step === 'reroll'">
      <div class="list">
        <button v-for="habit in habitStore.habits" :key="habit.id" type="button" class="row" @click="chooseReroll(habit.id)">
          <strong>{{ habit.name }}</strong>
          <span class="row-meta">{{ habit.period }} · currently {{ habit.damageType }}</span>
        </button>
      </div>
      <button type="button" class="back" @click="step = 'choose'">← Back</button>
    </template>

    <template v-else>
      <QuestForm @submit="chooseQuest" />
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
  font-size: 2.25rem;
  line-height: 1;
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

.list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  text-align: left;
  background: var(--code-bg);
  border: 1px solid var(--border);
}

.row:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.row-meta {
  color: var(--text);
  font-size: 0.85rem;
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
