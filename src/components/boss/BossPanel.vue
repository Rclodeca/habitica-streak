<script setup lang="ts">
import { computed } from 'vue';
import { useBossStore } from '../../store/bossStore';

const bossStore = useBossStore();

const boss = computed(() => bossStore.boss);
</script>

<template>
  <section class="panel boss-panel">
    <h2>Boss #{{ boss.index }} — {{ boss.personality }}</h2>
    <p>HP: {{ Math.round(boss.health) }} / {{ Math.round(boss.maxHealth) }}</p>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
}
</style>
