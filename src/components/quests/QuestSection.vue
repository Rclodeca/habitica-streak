<script setup lang="ts">
import { useCombatActions } from '../../composables/useCombatActions';
import { useQuestStore } from '../../store/questStore';

const questStore = useQuestStore();
const { completeQuest } = useCombatActions();

function onCheckOff(questId: string) {
  completeQuest(questId);
}
</script>

<template>
  <section class="panel quest-section">
    <h2>Quests</h2>
    <ul v-if="questStore.quests.length">
      <li v-for="quest in questStore.quests" :key="quest.id" class="quest-item">
        <input type="checkbox" :aria-label="`Complete ${quest.description}`" @change="onCheckOff(quest.id)" />
        <span class="description">{{ quest.description }}</span>
        <span class="difficulty-badge">{{ quest.difficulty }}</span>
        <span class="due-date">Due {{ quest.dueDateKey }}</span>
      </li>
    </ul>
    <p v-else>No active quests.</p>
  </section>
</template>

<style scoped>
.quest-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
}

.description {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}

.difficulty-badge {
  flex-shrink: 0;
  font-size: 0.75em;
  opacity: 0.8;
  text-transform: capitalize;
}

.due-date {
  flex-shrink: 0;
  font-size: 0.8em;
  opacity: 0.7;
}
</style>
