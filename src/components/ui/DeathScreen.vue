<script setup lang="ts">
import { useCombatActions } from '../../composables/useCombatActions';
import { useDeathScreen } from '../../composables/useDeathScreen';
import Modal from './Modal.vue';

const { isDead } = useDeathScreen();
const { restart } = useCombatActions();
</script>

<template>
  <Modal :model-value="isDead" :dismissible="false" title="You died">
    <p class="death-message">
      Your character has fallen. Restarting gives you a fresh character and resets the boss to #1 — your habits
      are kept, but their damage types are re-rolled.
    </p>
    <button type="button" class="restart-button" @click="restart">Restart</button>
  </Modal>
</template>

<style scoped>
.death-message {
  margin: 0 0 1rem;
}

.restart-button {
  display: block;
}
</style>
