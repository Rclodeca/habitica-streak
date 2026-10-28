<script setup lang="ts">
// Generic, reusable modal shell — no domain knowledge of character/boss/habit
// state lives here. Consumers pass their content via the default slot and
// control visibility via the `modelValue` prop (v-model:modelValue / v-model).

import { onBeforeUnmount, ref, watch } from 'vue';
import { lockBodyScroll } from '../../composables/useBodyScrollLock';

const props = withDefaults(defineProps<{ modelValue: boolean; title?: string; dismissible?: boolean; maxWidth?: string; scrollKey?: unknown }>(), {
  dismissible: true,
  maxWidth: '420px',
});
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

// Keep the page behind the backdrop from scrolling while the modal is open.
let releaseScrollLock: (() => void) | null = null;
function unlock() {
  releaseScrollLock?.();
  releaseScrollLock = null;
}
watch(
  () => props.modelValue,
  (open) => {
    if (open && !releaseScrollLock) releaseScrollLock = lockBodyScroll();
    else if (!open) unlock();
  },
  { immediate: true },
);
onBeforeUnmount(unlock);

// A popup that shows queued entries one after another passes the entry as
// `scrollKey`, so each new one opens at the top, not where the last was left.
const scrollEl = ref<HTMLElement | null>(null);
watch(
  () => props.scrollKey,
  () => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0;
  },
  { flush: 'post' },
);

function close() {
  if (!props.dismissible) return;
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-backdrop" @click="close">
      <div class="modal-content" :class="{ 'has-footer': $slots.footer }" :style="{ maxWidth }" @click.stop>
        <div ref="scrollEl" class="modal-scroll">
          <div class="modal-header">
            <h3 v-if="title">{{ title }}</h3>
            <button v-if="dismissible" type="button" class="modal-close" aria-label="Close" @click="close">×</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
  overscroll-behavior: contain;
}

.modal-content {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow);
}

/* The frame never scrolls, only the header and body do, so anything drawn on
   the frame (a theme's corner brackets) stays locked to its border. A footer
   stays pinned to the bottom edge. */
.modal-scroll {
  min-height: 0;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.has-footer .modal-scroll {
  padding-bottom: 0.75rem;
}

.modal-footer {
  flex-shrink: 0;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid var(--border);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.modal-header h3 {
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  padding: 0.2em 0.4em;
  cursor: pointer;
}
</style>
