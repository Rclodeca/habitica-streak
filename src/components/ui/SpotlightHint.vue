<script setup lang="ts">
// A one-time pointer at something to tap: darkens the screen except for
// `target`, with a callout pointing at it. The lit hole is a button of its
// own laid over the target (`tap`), since the overlay takes every other tap. Positions follow the target as the page lays out
// (art and fonts still loading move it) and on resize.

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { lockBodyScroll } from '../../composables/useBodyScrollLock';

const props = defineProps<{
  target: HTMLElement;
  // The lit hole's accessible name: what tapping it does.
  label: string;
  title: string;
  text: string;
  rules: string;
  // "Later" reads as a quiet way out; anything else as the main button.
  action: string;
}>();
const emit = defineEmits<{ tap: []; dismiss: [] }>();

// Room around the button inside the lit hole, and between hole and callout.
const HOLE_PAD = 6;
const GAP = 14;
// The callout's widest, and its least distance from the window's sides.
const CALLOUT_MAX = 360;
const GUTTER = 16;

const rect = ref<DOMRect | null>(null);
const callout = ref<HTMLElement | null>(null);
const calloutHeight = ref(0);

function measure() {
  rect.value = props.target.getBoundingClientRect();
  calloutHeight.value = callout.value?.offsetHeight ?? 0;
}

const holeStyle = computed(() => {
  const r = rect.value;
  if (!r) return {};
  return {
    left: `${r.left - HOLE_PAD}px`,
    top: `${r.top - HOLE_PAD}px`,
    width: `${r.width + HOLE_PAD * 2}px`,
    height: `${r.height + HOLE_PAD * 2}px`,
  };
});

// Below the button, or above it when there's no room underneath.
const above = computed(() => {
  const r = rect.value;
  return !!r && r.bottom + HOLE_PAD + GAP + calloutHeight.value > window.innerHeight && r.top > window.innerHeight / 2;
});

// Its right edge lines up with the lit hole's, kept inside the window.
const calloutBox = computed(() => {
  const r = rect.value;
  if (!r) return null;
  const width = Math.min(CALLOUT_MAX, window.innerWidth - GUTTER * 2);
  const left = Math.min(Math.max(GUTTER, r.right + HOLE_PAD - width), window.innerWidth - GUTTER - width);
  return { width, left };
});

const calloutStyle = computed(() => {
  const r = rect.value;
  const box = calloutBox.value;
  if (!r || !box) return { visibility: 'hidden' as const };
  const vertical = above.value
    ? { bottom: `${window.innerHeight - r.top + HOLE_PAD + GAP}px` }
    : { top: `${r.bottom + HOLE_PAD + GAP}px` };
  return { ...vertical, left: `${box.left}px`, width: `${box.width}px` };
});

// The callout's pointer sits under the button's center.
const arrowStyle = computed(() => {
  const r = rect.value;
  const box = calloutBox.value;
  if (!r || !box) return {};
  return { left: `${r.left + r.width / 2 - box.left}px` };
});

let releaseScrollLock: (() => void) | null = null;
let layoutObserver: ResizeObserver | null = null;

onMounted(async () => {
  props.target.scrollIntoView?.({ block: 'nearest' });
  releaseScrollLock = lockBodyScroll();
  measure();
  await nextTick();
  measure();
  window.addEventListener('resize', measure);
  if (typeof ResizeObserver !== 'undefined') {
    layoutObserver = new ResizeObserver(measure);
    layoutObserver.observe(document.body);
    layoutObserver.observe(props.target);
  }
  document.fonts?.ready.then(measure);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  layoutObserver?.disconnect();
  releaseScrollLock?.();
});
</script>

<template>
  <Teleport to="body">
    <div class="spotlight-hint" role="dialog" :aria-label="title">
      <button type="button" class="hint-hole" :style="holeStyle" :aria-label="label" @click="emit('tap')" />
      <div ref="callout" class="hint-callout" :class="{ above }" :style="calloutStyle">
        <span class="hint-arrow" :style="arrowStyle" />
        <h3 class="hint-title">{{ title }}</h3>
        <p class="hint-text">{{ text }}</p>
        <p class="hint-rules">{{ rules }}</p>
        <div class="hint-actions">
          <button type="button" class="hint-action" :class="{ quiet: action === 'Later' }" @click="emit('dismiss')">{{ action }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.spotlight-hint {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overscroll-behavior: contain;
}

.hint-hole {
  position: fixed;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.78),
    0 0 0 3px var(--accent-border),
    0 0 24px var(--accent-border);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.hint-hole::after {
  content: '';
  position: absolute;
  inset: -6px;
  border: 1px solid var(--accent);
  border-radius: inherit;
  opacity: 0;
  animation: hint-pulse 1.8s ease-out infinite;
  pointer-events: none;
}

@keyframes hint-pulse {
  from {
    transform: scale(0.9);
    opacity: 0.8;
  }
  to {
    transform: scale(1.2);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hint-hole::after {
    animation: none;
    opacity: 0.6;
  }
}

.hint-callout {
  position: fixed;
  box-sizing: border-box;
  padding: 1rem 1rem 0.5rem;
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.hint-arrow {
  position: absolute;
  top: -7px;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  transform: rotate(45deg);
  background: var(--bg);
  border-left: 1px solid var(--border);
  border-top: 1px solid var(--border);
}

.hint-callout.above .hint-arrow {
  top: auto;
  bottom: -7px;
  border: 0;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.hint-title {
  margin: 0;
  font-size: 0.95rem;
  color: var(--accent);
}

.hint-text {
  margin: 0.4rem 0 0;
  color: var(--text-h);
}

.hint-rules {
  margin: 0.3rem 0 0;
  color: var(--text);
  font-size: 0.9rem;
}

.hint-actions {
  display: flex;
  justify-content: flex-end;
}

.hint-action {
  min-height: 44px;
  padding: 0 0.5rem;
  border: 0;
  background: none;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}

.hint-action.quiet {
  color: var(--text);
  font-weight: inherit;
}
</style>
