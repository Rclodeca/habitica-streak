<script setup lang="ts">
import { computed, ref } from 'vue';
import BossPanel from '../boss/BossPanel.vue';
import CharacterPanel from '../character/CharacterPanel.vue';
import SkipDayButton from '../debug/SkipDayButton.vue';
import HabitList from '../habits/HabitList.vue';
import HighScorePage from '../highscores/HighScorePage.vue';
import QuestSection from '../quests/QuestSection.vue';
import ActivityLog from '../ui/ActivityLog.vue';
import DeathScreen from '../ui/DeathScreen.vue';
import ItemDropPopup from '../ui/ItemDropPopup.vue';
import MissedSkillsPopup from '../ui/MissedSkillsPopup.vue';
import QuestMissPopup from '../quests/QuestMissPopup.vue';
import QuestOfferModal from '../quests/QuestOfferModal.vue';
import ReviveNotice from '../ui/ReviveNotice.vue';
import SlotUnlockPopup from '../ui/SlotUnlockPopup.vue';
import { useBossStore } from '../../store/bossStore';
import { useHighScoreStore } from '../../store/highScoreStore';

const bossStore = useBossStore();
const highScoreStore = useHighScoreStore();

const isDev = import.meta.env.DEV;

const bossIndex = computed(() => bossStore.boss.index);
const bestBossIndex = computed(() => highScoreStore.highestBossIndex);

// No router in this app — swaps the main content for HighScorePage in place
// rather than navigating. The popup overlays below stay mounted regardless
// (they're independently gated Teleports, see useModalPriority), so a
// queued death/item/quest popup isn't hidden by this toggle.
const showHighScores = ref(false);
</script>

<template>
  <div class="app-shell">
    <div class="progress-bar">
      <span>Boss #{{ bossIndex }}</span>
      <span>Best: Boss #{{ bestBossIndex }}</span>
      <button type="button" class="nav-button" @click="showHighScores = !showHighScores">
        {{ showHighScores ? '← Back' : '🏆 High Scores' }}
      </button>
    </div>
    <DeathScreen />
    <ItemDropPopup />
    <MissedSkillsPopup />
    <SlotUnlockPopup />
    <QuestOfferModal />
    <QuestMissPopup />
    <ReviveNotice />

    <HighScorePage v-if="showHighScores" />
    <template v-else>
      <SkipDayButton v-if="isDev" />
      <div class="top-panels">
        <BossPanel />
        <CharacterPanel />
      </div>
      <HabitList />
      <QuestSection />
      <ActivityLog />
    </template>
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
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-h);
}

.nav-button {
  padding: 0.3em 0.7em;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
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
