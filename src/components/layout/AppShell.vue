<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeft, Trophy } from 'lucide-vue-next';
import BossPanel from '../boss/BossPanel.vue';
import CharacterPanel from '../character/CharacterPanel.vue';
import PopupPreview from '../debug/PopupPreview.vue';
import SkipDayButton from '../debug/SkipDayButton.vue';
import HabitList from '../habits/HabitList.vue';
import HighScorePage from '../highscores/HighScorePage.vue';
import QuestSection from '../quests/QuestSection.vue';
import ProgressSummary from './ProgressSummary.vue';
import ActivityLog from '../ui/ActivityLog.vue';
import DeathScreen from '../ui/DeathScreen.vue';
import ItemDropPopup from '../ui/ItemDropPopup.vue';
import MissedSkillsPopup from '../ui/MissedSkillsPopup.vue';
import QuestCompletePopup from '../quests/QuestCompletePopup.vue';
import QuestMissPopup from '../quests/QuestMissPopup.vue';
import EventChoiceModal from '../events/EventChoiceModal.vue';
import ReviveNotice from '../ui/ReviveNotice.vue';
import { useBossStore } from '../../store/bossStore';

const bossStore = useBossStore();

const isDev = import.meta.env.DEV;

const bossIndex = computed(() => bossStore.boss.index);

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
      <button type="button" class="nav-button" @click="showHighScores = !showHighScores">
        <template v-if="showHighScores"><ArrowLeft :size="14" />Back</template>
        <template v-else><Trophy :size="14" />High Scores</template>
      </button>
    </div>
    <DeathScreen />
    <ItemDropPopup />
    <MissedSkillsPopup />
    <EventChoiceModal />
    <QuestMissPopup />
    <QuestCompletePopup />
    <ReviveNotice />

    <HighScorePage v-if="showHighScores" />
    <template v-else>
      <SkipDayButton v-if="isDev" />
      <PopupPreview v-if="isDev" />
      <div class="layout">
        <aside class="side">
          <BossPanel />
          <CharacterPanel />
        </aside>
        <main class="main">
          <ProgressSummary />
          <HabitList />
          <QuestSection />
          <ActivityLog />
        </main>
      </div>
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
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3em 0.7em;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.side {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

@media (max-width: 820px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side {
    position: static;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}
</style>
