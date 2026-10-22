<script setup lang="ts">
import { computed, ref } from 'vue';
import { Lock } from 'lucide-vue-next';
import { dailyPeriodKey, ITEM_CATALOG, questRewardTier, questsOpen, QUESTS_UNLOCK_LEVEL } from '../../game-engine';
import type { Difficulty, ItemDef, Quest } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useQuestStore } from '../../store/questStore';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import QuestDetailModal from './QuestDetailModal.vue';
import QuestForm from './QuestForm.vue';

const questStore = useQuestStore();
const characterStore = useCharacterStore();
const debugClockStore = useDebugClockStore();

// Sealed until QUESTS_UNLOCK_LEVEL each run, unless quests carried over (see questsOpen).
const open = computed(() => questsOpen(characterStore.character));
const { completeQuest } = useCombatActions();
const { enqueue: enqueueCompletion } = useQuestCompleteQueue();

const PIPS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const MS_PER_DAY = 86_400_000;
const baseUrl = import.meta.env.BASE_URL;

const todayKey = computed(() => dailyPeriodKey(debugClockStore.now()));
const showAdd = ref(false);
const detailId = ref<string | null>(null);
const detailQuest = computed(() => questStore.quests.find((q) => q.id === detailId.value) ?? null);

function daysLeft(quest: Quest): number {
  return Math.round((Date.parse(`${quest.dueDateKey}T00:00:00Z`) - Date.parse(`${todayKey.value}T00:00:00Z`)) / MS_PER_DAY);
}

function urgency(quest: Quest): 'urgent' | 'soon' | 'calm' {
  const days = daysLeft(quest);
  if (days <= 0) return 'urgent';
  return days <= 2 ? 'soon' : 'calm';
}

function dueText(quest: Quest): string {
  const days = daysLeft(quest);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

function rewardItem(quest: Quest): ItemDef | null {
  return ITEM_CATALOG.find((item) => item.id === quest.rewardItemId) ?? null;
}

function onAdd(description: string, difficulty: Difficulty, dueDateKey: string) {
  questStore.addQuest(description, difficulty, dueDateKey);
  showAdd.value = false;
}

function onCheckOff(quest: Quest) {
  const result = completeQuest(quest.id);
  if (result && result.amount > 0) {
    enqueueCompletion({ description: quest.description, difficulty: quest.difficulty, amount: result.amount });
  }
}
</script>

<template>
  <section class="panel quest-section" :class="{ locked: !open }">
    <div class="quest-header">
      <h2><Lock v-if="!open" :size="14" class="lock-icon" />Quests</h2>
      <button v-if="open" type="button" class="add-button" aria-label="Add quest" @click="showAdd = true">+ New quest</button>
    </div>
    <div v-if="!open" class="lock-area">
      <div class="lock-ghost" aria-hidden="true"><i /><i /></div>
      <div class="lock-seal">
        <span class="lock-mark"><Lock :size="18" /></span>
        <p class="lock-text">Sealed until level {{ QUESTS_UNLOCK_LEVEL }}</p>
      </div>
    </div>
    <ul v-else-if="questStore.quests.length">
      <li v-for="quest in questStore.quests" :key="quest.id" class="quest-item" :class="[urgency(quest), { side: quest.kind === 'side' }]">
        <input type="checkbox" class="check" :aria-label="`Complete ${quest.description}`" @change="onCheckOff(quest)" />
        <button type="button" class="body" @click="detailId = quest.id">
          <span class="description">{{ quest.description }}</span>
          <span class="meta">
            <span class="pips" :title="quest.difficulty">
              <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= PIPS[quest.difficulty] }" />
            </span>
            <span class="due">{{ dueText(quest) }}</span>
          </span>
        </button>
        <img v-if="quest.kind === 'side' && rewardItem(quest)" class="reward-icon" :src="`${baseUrl}sprites/${rewardItem(quest)!.icon}.png`" alt="" />
        <!-- The exact EXP depends on the week's slot, so only the vague tier is offered, on hover. -->
        <span v-else-if="quest.kind === 'regular'" class="reward-exp" :title="`${questRewardTier(quest.difficulty)} EXP`">
          <StatIcon name="exp" :size="20" /><span class="exp-label">+EXP</span>
        </span>
      </li>
    </ul>
    <p v-else>No active quests.</p>
  </section>

  <Modal v-model="showAdd" title="New quest" max-width="480px">
    <QuestForm kind="regular" @submit="onAdd" />
  </Modal>

  <QuestDetailModal :quest="detailQuest" @close="detailId = null" />
</template>

<style scoped>
.quest-section ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quest-item {
  --tone: var(--border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}

.quest-item.soon {
  --tone: var(--soon-color);
}

.quest-item.urgent {
  --tone: var(--damage-color);
  box-shadow: 0 0 14px -8px var(--damage-color);
}

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

.check:hover {
  border-color: var(--accent-border);
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

.check:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.quest-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quest-header h2 {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

/* Sealed until QUESTS_UNLOCK_LEVEL: two blurred placeholder rows under a lock. */
.locked h2 {
  color: var(--text);
}

.lock-area {
  position: relative;
  margin-top: 0.75rem;
}

.lock-ghost {
  display: grid;
  gap: 0.5rem;
  opacity: 0.35;
  filter: blur(2px);
}

.lock-ghost i {
  display: block;
  height: 3rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.lock-seal {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.lock-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 50%;
}

.lock-text {
  margin: 0;
  color: var(--text);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.add-button {
  padding: 0.35rem 0.9rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.quest-section ul {
  margin-top: 0.75rem;
}

.quest-item.side {
  --tone: var(--side-quest-color);
  background: linear-gradient(90deg, color-mix(in srgb, var(--side-quest-color) 10%, transparent), var(--code-bg) 60%);
  box-shadow: 0 0 14px -8px var(--side-quest-color);
}

.quest-item.side.urgent {
  --tone: var(--damage-color);
  box-shadow: 0 0 14px -8px var(--damage-color);
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  text-align: left;
  cursor: pointer;
}

.description {
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
}

.pips {
  display: flex;
  gap: 0.25rem;
}

.pip {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--accent);
}

.due {
  color: var(--text);
}

.soon .due {
  color: var(--soon-color);
}

.urgent .due {
  color: var(--damage-color);
}

.reward-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: -0.4rem 0;
  image-rendering: pixelated;
}

/* Same width as .reward-icon. Icon and label are centred in the row as one
   tight unit — line-height 1 matters: the inherited one is a fixed ~26px
   (see style.css) and would make the label far taller than its text. */
.reward-exp {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 44px;
  color: var(--icon-exp);
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  cursor: default;
}
</style>
