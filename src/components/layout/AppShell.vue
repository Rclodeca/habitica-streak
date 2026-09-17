<script setup lang="ts">
import { computed } from 'vue';
import BossPanel from '../boss/BossPanel.vue';
import CharacterPanel from '../character/CharacterPanel.vue';
import SkipDayButton from '../debug/SkipDayButton.vue';
import HabitList from '../habits/HabitList.vue';
import DeathScreen from '../ui/DeathScreen.vue';
import ItemDropPopup from '../ui/ItemDropPopup.vue';
import ReviveNotice from '../ui/ReviveNotice.vue';
import { useBossStore } from '../../store/bossStore';
import { useHighScoreStore } from '../../store/highScoreStore';

const bossStore = useBossStore();
const highScoreStore = useHighScoreStore();

const isDev = import.meta.env.DEV;

const bossIndex = computed(() => bossStore.boss.index);
const bestBossIndex = computed(() => highScoreStore.highestBossIndex);
</script>

<template>
  <div class="app-shell">
    <div class="progress-bar">
      <span>Boss #{{ bossIndex }}</span>
      <span>Best: Boss #{{ bestBossIndex }}</span>
    </div>
    <DeathScreen />
    <ItemDropPopup />
    <ReviveNotice />
    <SkipDayButton v-if="isDev" />
    <div class="top-panels">
      <BossPanel />
      <CharacterPanel />
    </div>
    <HabitList />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  text-align: left;
}

.progress-bar {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-h);
}

.top-panels {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.top-panels > * {
  flex: 1 1 260px;
}
</style>
