<script setup lang="ts">
import { onMounted } from 'vue';
import AppShell from './components/layout/AppShell.vue';
import { useDailyRollover } from './composables/useDailyRollover';

// Runs once per app load: checks every habit against the period boundary it
// crossed since the last time the app was open, and records a miss for any
// habit that wasn't completed in the immediately-preceding period.
onMounted(() => {
  useDailyRollover();
});
</script>

<template>
  <AppShell />
</template>
