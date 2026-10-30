<script setup lang="ts">
import { questRewardTier } from '../../game-engine';
import type { Quest } from '../../game-engine';
import Modal from '../ui/Modal.vue';

defineProps<{ quest: Quest | null }>();
const emit = defineEmits<{ close: [] }>();

const PIPS = { easy: 1, medium: 2, hard: 3 };
</script>

<template>
  <Modal :model-value="quest !== null" :title="quest?.kind === 'side' ? 'Side quest' : 'Quest'" max-width="420px" @update:model-value="emit('close')">
    <div v-if="quest" class="detail">
      <p class="deed">{{ quest.description }}</p>
      <div class="meta">
        <span class="pips" :title="quest.difficulty">
          <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= PIPS[quest.difficulty] }" />
        </span>
        <span>Due {{ quest.dueDateKey }}</span>
      </div>
      <!-- A side quest's item stays hidden until it's earned. -->
      <p v-if="quest.kind === 'side'" class="reward">An unknown item</p>
      <p v-else class="reward">{{ questRewardTier(quest.difficulty) }} EXP</p>
    </div>
  </Modal>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.deed {
  margin: 0;
  color: var(--text-h);
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.pips {
  display: flex;
  gap: 0.3rem;
}

.pip {
  width: 0.55rem;
  height: 0.55rem;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--accent);
}

.reward {
  margin: 0;
  color: var(--stat-color);
  font-size: 1rem;
}
</style>
