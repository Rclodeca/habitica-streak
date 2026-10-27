<script setup lang="ts">
import { useModalPriority } from '../../composables/useModalPriority';
import { formatCompact } from '../../game-engine';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { BadgeCheck } from 'lucide-vue-next';
import Modal from '../ui/Modal.vue';

const { current, dismiss } = useQuestCompleteQueue();
const { questCompleteVisible } = useModalPriority();

const PIPS = { easy: 1, medium: 2, hard: 3 };
</script>

<template>
  <Modal :model-value="questCompleteVisible" title="Quest complete" max-width="420px" @update:model-value="dismiss">
    <div v-if="current" :key="current.description" class="hero">
      <div class="seal" aria-hidden="true">
        <BadgeCheck class="seal-icon" :size="42" :stroke-width="1.75" />
      </div>
      <p class="deed">{{ current.description }}</p>
      <span class="pips" :title="current.difficulty">
        <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= PIPS[current.difficulty] }" />
      </span>
      <strong class="reward">+{{ formatCompact(current.amount) }} EXP</strong>
    </div>
    <button type="button" class="onward primary-button" @click="dismiss">Onward</button>
  </Modal>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem 1rem;
  background: var(--code-bg);
  border: 1px solid var(--accent);
  border-radius: 12px;
  box-shadow: 0 0 24px -6px var(--accent);
  text-align: center;
  overflow: hidden;
  animation: rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 35%, rgba(255, 255, 255, 0.09) 50%, transparent 65%);
  transform: translateX(-100%);
  animation: sheen 1.4s 0.3s ease-out forwards;
  pointer-events: none;
}

.seal {
  width: 88px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, var(--accent-bg), transparent 70%);
  border: 2px solid var(--accent);
  border-radius: 50%;
  animation: pulse 2.4s ease-in-out infinite;
}

.seal-icon {
  color: var(--accent);
  filter: drop-shadow(0 0 10px var(--accent));
}

.deed {
  margin: 0;
  color: var(--text-h);
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.pips {
  display: flex;
  gap: 0.35rem;
}

.pip {
  width: 0.6rem;
  height: 0.6rem;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.reward {
  color: var(--stat-color);
  font-size: 1.6rem;
  letter-spacing: 0.03em;
  text-shadow: 0 0 14px color-mix(in srgb, var(--stat-color) 60%, transparent);
}

.onward {
  display: block;
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.8rem 1.2rem;
  letter-spacing: 0.04em;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.94);
  }
}

@keyframes sheen {
  to {
    transform: translateX(100%);
  }
}

@keyframes pulse {
  50% {
    box-shadow: 0 0 22px -2px var(--accent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .hero::before,
  .seal {
    animation: none;
  }
}
</style>
