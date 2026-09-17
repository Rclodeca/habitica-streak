<script setup lang="ts">
import { useLootToast } from '../../composables/useLootToast';

const { toasts } = useLootToast();
</script>

<template>
  <div class="loot-toast-stack">
    <div v-for="toast in toasts" :key="toast.id" class="loot-toast">{{ toast.message }}</div>
  </div>
</template>

<style scoped>
.loot-toast-stack {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  z-index: 1100;
  pointer-events: none;
}

.loot-toast {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
  box-shadow: var(--shadow);
  animation: loot-toast-fade 3s ease forwards;
}

@keyframes loot-toast-fade {
  0%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
