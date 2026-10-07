<script setup lang="ts">
import { useDeathScreen } from '../../composables/useDeathScreen';
import { useSlotUnlockNotice } from '../../composables/useSlotUnlockNotice';
import Modal from './Modal.vue';

const { isPending, dismiss } = useSlotUnlockNotice();
const { isDead } = useDeathScreen();
</script>

<template>
  <Modal :model-value="isPending && !isDead" :dismissible="false" title="New item slots!">
    <p class="notice-text">Your item slots have increased from 4 to 6.</p>
    <button type="button" class="ok-button" @click="dismiss">Nice!</button>
  </Modal>
</template>

<style scoped>
.notice-text {
  margin: 0 0 1rem;
}

.ok-button {
  display: block;
}
</style>
