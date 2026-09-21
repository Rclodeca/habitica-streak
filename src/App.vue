<script setup lang="ts">
import { onMounted } from 'vue';
import AppShell from './components/layout/AppShell.vue';
import { useCombatActions } from './composables/useCombatActions';
import { useDailyRollover } from './composables/useDailyRollover';
import { useDebugClockStore } from './store/debugClockStore';

// Runs once per app load: checks every habit against the period boundary it
// crossed since the last time the app was open, and records a miss for any
// habit that wasn't completed in the immediately-preceding period.
onMounted(() => {
  useDailyRollover(useDebugClockStore().now());
  // Retroactively assigns Special/Ult if the character is already past
  // level 3/6 from before these mechanics existed.
  useCombatActions().checkLevelRewards();
});
</script>

<template>
  <AppShell />
</template>
