<script setup lang="ts">
import { computed } from 'vue';
import type { HeroClass } from '../../game-engine';
import type { CelebrationPhase } from '../../composables/useCelebration';
import { useDamagePopup } from '../../composables/useDamagePopup';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';
import { DRAWN_FACING_LEFT } from '../character/heroArt';

// Once the fight stage has scrolled off the top, at every width, this bar
// drops in so every hit stays in view while ticking skills (FightStage decides
// when, see useScrolledPast). It is status only, not tappable: the details
// open from the stage. Laid out like the fight: the hero on the left, HP as
// a ring around their portrait with the level on it, and the boss taking the
// rest of the row, its HP draining toward its portrait on the right.
// A kill plays here in miniature (see useCelebration): the portrait sinks and
// "Slain" takes the HP numbers' place, then the next boss rises.
const props = defineProps<{
  sprite: string;
  name: string;
  current: number;
  max: number;
  heroClass: HeroClass;
  heroCurrent: number;
  heroMax: number;
  heroLevel: number;
  shown: boolean;
  phase?: CelebrationPhase;
  /** Turns the boss's portrait around, for art drawn facing away from the hero. */
  spriteMirrored?: boolean;
}>();

const baseUrl = import.meta.env.BASE_URL;

// Below this share of HP the ring pulses, since it has no numbers to read.
const LOW_HEALTH_SHARE = 0.25;

const RING_RADIUS = 20;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const heroShare = computed(() => (props.heroMax > 0 ? Math.max(0, Math.min(1, props.heroCurrent / props.heroMax)) : 0));
const ringOffset = computed(() => RING_LENGTH * (1 - heroShare.value));
const heroLow = computed(() => heroShare.value < LOW_HEALTH_SHARE);

const { popups, isHit } = useDamagePopup(() => props.current);
const { popups: heroPopups, isHit: heroHit } = useDamagePopup(() => props.heroCurrent);
</script>

<template>
  <div class="boss-bar" :class="{ shown }" :inert="!shown || undefined">
    <span class="ring" :class="{ hit: heroHit, low: heroLow }">
      <svg class="ring-track" viewBox="0 0 44 44" aria-hidden="true">
        <circle class="track" cx="22" cy="22" :r="RING_RADIUS" />
        <circle class="arc" cx="22" cy="22" :r="RING_RADIUS" :stroke-dasharray="RING_LENGTH" :stroke-dashoffset="ringOffset" />
      </svg>
      <span class="ring-face" :class="{ mirrored: DRAWN_FACING_LEFT[heroClass] }">
        <img class="hero" :src="`${baseUrl}sprites/player/${heroClass}.png`" alt="" />
      </span>
      <span class="level"><span>{{ heroLevel }}</span></span>
      <span v-for="popup in heroPopups" :key="popup.id" class="damage-popup" aria-hidden="true">-{{ popup.amount }}</span>
    </span>
    <span class="who">
      <span class="label">
        <span v-if="phase === 'dying'" class="slain">Slain</span>
        <span v-else class="numbers">{{ Math.round(current) }} / {{ Math.round(max) }}</span>
        <span class="name">{{ name }}</span>
      </span>
      <HealthBar :current="current" :max="max" variant="boss" />
    </span>
    <span class="portrait" :class="{ hit: isHit, dying: phase === 'dying', arriving: phase === 'arriving', mirrored: spriteMirrored }">
      <Sprite :image-name="sprite" alt="" />
    </span>
    <span class="hit-layer" aria-hidden="true">
      <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
    </span>
  </div>
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
  padding: calc(0.75rem + env(safe-area-inset-top, 0px)) 1rem 0.7rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 14px 24px -14px rgba(0, 0, 0, 0.6);
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

.portrait.mirrored :deep(.sprite) {
  scale: -1 1;
}

.portrait.hit :deep(.sprite) {
  animation: bar-shake 0.32s ease;
}

.portrait.dying :deep(.sprite) {
  transform-origin: 50% 100%;
  animation: bar-fall 1.1s cubic-bezier(0.5, 0, 0.8, 0.4) both;
}

.portrait.arriving :deep(.sprite) {
  animation: bar-arrive 0.8s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

/* The hero: a round portrait inside an HP ring that empties clockwise from
   the top, the same 44px as the boss's portrait so the bar keeps its height. */
.ring {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
}

.ring-track {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.ring circle {
  fill: none;
  stroke-width: 3;
}

.ring .track {
  stroke: var(--border);
}

.ring .arc {
  stroke: var(--hp-color);
  transition: stroke-dashoffset 0.3s ease;
}

.ring.low .arc {
  animation: ring-low 1.1s ease-in-out infinite;
}

.ring-face {
  position: absolute;
  inset: 4px;
  display: grid;
  place-items: end center;
  overflow: hidden;
  background: var(--code-bg);
  border-radius: 50%;
}

.ring-face.mirrored {
  transform: scaleX(-1);
}

.hero {
  width: 38px;
  height: 38px;
  margin-bottom: -3px;
  image-rendering: pixelated;
}

.ring.hit .hero {
  animation: bar-shake 0.32s ease;
}

.level {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-h);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
}

/* The hero's hits rise from the ring itself rather than the bar's middle. */
.ring .damage-popup {
  top: -4px;
}

.slain {
  flex-shrink: 0;
  color: var(--text-h);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  text-shadow: 0 0 10px var(--accent);
  animation: bar-slain 0.3s ease-out;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

/* The HP numbers and name share a row over a thin bar, the name by the boss's
   portrait; a long name gives way to the numbers. */
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
  text-align: right;
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

/* Drains toward the boss's portrait, its trail with it. */
.who :deep(.health-bar-fill) {
  margin-left: auto;
}

.who :deep(.health-bar-trail) {
  left: auto;
  right: 0;
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

/* Full width, its content held to the app's column (#app's 1280px less its
   2rem padding each side). */
@media (min-width: 821px) {
  .boss-bar {
    padding-inline: max(1rem, calc((100vw - 1216px) / 2));
  }
}

@media (prefers-reduced-motion: reduce) {
  .boss-bar {
    transition: none;
  }

  .portrait.dying :deep(.sprite) {
    animation: none;
    opacity: 0;
  }

  .portrait.arriving :deep(.sprite),
  .slain {
    animation: none;
  }

  /* Still marked, just not pulsing. */
  .ring.low .arc {
    animation: none;
    stroke-width: 4;
  }
}

@keyframes ring-low {
  50% {
    opacity: 0.35;
  }
}

@keyframes bar-fall {
  0% {
    transform: none;
    opacity: 1;
  }
  25% {
    transform: translateX(-2px) rotate(-3deg);
    opacity: 1;
  }
  100% {
    transform: translateY(18px) scaleY(0.7);
    opacity: 0;
  }
}

@keyframes bar-arrive {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes bar-slain {
  0% {
    opacity: 0;
    transform: scale(1.3);
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
