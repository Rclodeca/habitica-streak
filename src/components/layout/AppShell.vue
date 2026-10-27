<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeft } from 'lucide-vue-next';
import AppMenu from './AppMenu.vue';
import NewHeroScreen from './NewHeroScreen.vue';
import PopupPreview from '../debug/PopupPreview.vue';
import FightStage from '../fight/FightStage.vue';
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
import QuestUnlockPopup from '../quests/QuestUnlockPopup.vue';
import EventChoiceModal from '../events/EventChoiceModal.vue';
import ReviveNotice from '../ui/ReviveNotice.vue';
import BossSkillPopup from '../boss/BossSkillPopup.vue';
import { useCelebration } from '../../composables/useCelebration';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';

const bossStore = useBossStore();
const characterStore = useCharacterStore();

const isDev = import.meta.env.DEV;

// Follows the fight stage, which keeps a slain boss up until the next arrives.
const { displayedBoss } = useCelebration();
const bossIndex = computed(() => (displayedBoss.value ?? bossStore.boss).index);

// An unnamed hero (first launch, or a new run after a death) gets the
// full-screen NewHeroScreen instead of the whole shell. The popups live inside
// the shell, so anything queued meanwhile simply waits until the hero is named.
const needsName = computed(() => characterStore.character.name === undefined);

// No router in this app — swaps the main content for HighScorePage in place
// rather than navigating. It's opened from AppMenu and closed with the Back
// button. The popup overlays below stay mounted regardless (they're
// independently gated Teleports, see useModalPriority), so a queued
// death/item/quest popup isn't hidden by this toggle.
const showHighScores = ref(false);
</script>

<template>
  <NewHeroScreen v-if="needsName" />
  <div v-else class="app-shell">
    <div class="progress-bar">
      <span>Boss #{{ bossIndex }}</span>
      <div class="top-actions">
        <button v-if="showHighScores" type="button" class="nav-button" @click="showHighScores = false"><ArrowLeft :size="14" />Back</button>
        <AppMenu @high-scores="showHighScores = true" />
      </div>
    </div>
    <DeathScreen />
    <ItemDropPopup />
    <MissedSkillsPopup />
    <EventChoiceModal />
    <QuestMissPopup />
    <BossSkillPopup />
    <QuestCompletePopup />
    <QuestUnlockPopup />
    <ReviveNotice />

    <HighScorePage v-if="showHighScores" />
    <template v-else>
      <SkipDayButton v-if="isDev" />
      <PopupPreview v-if="isDev" />
      <div class="layout">
        <FightStage />
        <main class="main">
          <HabitList />
          <QuestSection />
        </main>
        <aside class="side">
          <ProgressSummary class="progress" />
          <ActivityLog />
        </aside>
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

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 1.25rem;
  align-items: start;
}

/* The fight runs across the page as a banner, then skills and quests on the
   left and progress and the log on the right. Nothing sticks: the banner
   scrolls away and the drop-down bar takes over. */
.layout > .fight-stage {
  grid-column: 1 / -1;
}

.main,
.side {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

@media (max-width: 1024px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}

/* Phones: one column, every section a row of the grid spaced like the rest.
   The progress rings are desktop and tablet only. */
@media (max-width: 820px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .main,
  .side {
    display: contents;
  }

  .progress {
    display: none;
  }
}
</style>
