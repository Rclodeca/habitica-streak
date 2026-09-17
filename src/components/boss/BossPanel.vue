<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBossStore } from '../../store/bossStore';
import BossStatsModal from './BossStatsModal.vue';

const bossStore = useBossStore();

const boss = computed(() => bossStore.boss);

const showStatsModal = ref(false);
</script>

<template>
  <section class="panel boss-panel" @click="showStatsModal = true">
    <h2>Boss #{{ boss.index }} — {{ boss.personality }}</h2>
    <p>HP: {{ Math.round(boss.health) }} / {{ Math.round(boss.maxHealth) }}</p>
  </section>

  <BossStatsModal v-model="showStatsModal" :boss="boss" />
</template>

<style scoped>
.panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
}
</style>
