<script setup lang="ts">
import { useDamagePopup } from '../../composables/useDamagePopup';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';

// Phones only: once the boss panel has scrolled off the top, this bar drops
// in so every hit stays in view while ticking skills (BossPanel decides when,
// see useScrolledPast). Just the boss — portrait, name and HP; the hero
// scrolls away with the page. Desktop keeps the boss in its pinned side column.
const props = defineProps<{
  sprite: string;
  name: string;
  current: number;
  max: number;
  shown: boolean;
}>();

defineEmits<{ open: [] }>();

const { popups, isHit } = useDamagePopup(() => props.current);
</script>

<template>
  <button type="button" class="boss-bar" :class="{ shown }" :inert="!shown || undefined" @click="$emit('open')">
    <span class="portrait" :class="{ hit: isHit }">
      <Sprite :image-name="sprite" alt="" />
    </span>
    <span class="who">
      <span class="label">
        <span class="name">{{ name }}</span>
        <span class="numbers">{{ Math.round(current) }} / {{ Math.round(max) }}</span>
      </span>
      <HealthBar :current="current" :max="max" variant="boss" />
    </span>
    <span class="hit-layer" aria-hidden="true">
      <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
    </span>
  </button>
</template>

<style scoped>
/* Parked above the top edge, clear of its own shadow, until it drops in. */
.boss-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0;
  padding: calc(0.75rem + env(safe-area-inset-top, 0px)) 1rem 0.7rem;
  background: var(--bg);
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  box-shadow: 0 14px 24px -14px rgba(0, 0, 0, 0.6);
  color: inherit;
  text-align: left;
  transform: translateY(calc(-100% - 24px));
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.boss-bar.shown {
  transform: none;
}

.portrait {
  flex-shrink: 0;
  display: grid;
  place-items: end center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  background: var(--code-bg);
  border: 1px solid var(--portrait-border);
  border-radius: 8px;
}

.portrait :deep(.sprite) {
  width: 42px;
  height: 42px;
  image-rendering: pixelated;
}

.portrait.hit :deep(.sprite) {
  animation: bar-shake 0.32s ease;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

/* The name and HP numbers share a row over a thin bar; a long name gives way
   to the numbers. */
.label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
}

.name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-h);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.numbers {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--text);
}

.who :deep(.health-bar) {
  height: 0.55rem;
}

.who :deep(.health-bar-label) {
  display: none;
}

.hit-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Rises from the middle of the bar (below the notch, if any). */
.damage-popup {
  position: absolute;
  top: calc(50% + env(safe-area-inset-top, 0px) / 2 - 10px);
  left: 50%;
  color: var(--hp-color);
  font-weight: 700;
  font-size: 1.05rem;
  line-height: 1;
  white-space: nowrap;
  text-shadow:
    0 0 10px #000,
    0 0 2px #000;
  animation: bar-hit 1s ease-out forwards;
}

@media (min-width: 821px) {
  .boss-bar {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .boss-bar {
    transition: none;
  }
}

@keyframes bar-shake {
  20% {
    transform: translateX(-3px);
  }
  40% {
    transform: translateX(4px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(2px);
  }
}

@keyframes bar-hit {
  0% {
    opacity: 0;
    transform: translate(-50%, 6px) scale(0.9);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.08);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -34px) scale(1);
  }
}
</style>
