<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBossStore } from '../../store/bossStore';
import BossStatsModal from './BossStatsModal.vue';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';

const bossStore = useBossStore();

const boss = computed(() => bossStore.boss);

const showStatsModal = ref(false);
</script>

<template>
  <section class="panel boss-panel" @click="showStatsModal = true">
    <div class="panel-header">
      <Sprite image-name="boss-placeholder" alt="Boss" />
      <h2>Boss #{{ boss.index }} — {{ boss.personality }}</h2>
    </div>
    <HealthBar :current="boss.health" :max="boss.maxHealth" variant="boss" />
  </section>

  <BossStatsModal v-model="showStatsModal" :boss="boss" />
</template>

<style scoped>
.boss-panel {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.panel-header h2 {
  margin: 0;
}
</style>
