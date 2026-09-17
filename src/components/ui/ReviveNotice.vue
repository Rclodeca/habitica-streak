<script setup lang="ts">
import { useReviveNotice } from '../../composables/useReviveNotice';

const { visible } = useReviveNotice();
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="revive-toast">🪶 Phoenix Feather consumed — revived at half health!</div>
  </Teleport>
</template>

<style scoped>
.revive-toast {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  box-shadow: var(--shadow);
  font-weight: 600;
  z-index: 1000;
  pointer-events: none;
}
</style>
