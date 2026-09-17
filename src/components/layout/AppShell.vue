<script setup lang="ts">
import BossPanel from '../boss/BossPanel.vue';
import CharacterPanel from '../character/CharacterPanel.vue';
import SkipDayButton from '../debug/SkipDayButton.vue';
import HabitList from '../habits/HabitList.vue';
</script>

<template>
  <div class="app-shell">
    <SkipDayButton />
    <div class="top-panels">
      <CharacterPanel />
      <BossPanel />
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

.top-panels {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.top-panels > * {
  flex: 1 1 260px;
}
</style>
