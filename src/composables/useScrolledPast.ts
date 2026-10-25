// True once `el` has scrolled up off the screen, behind a bar `cover()` px
// tall pinned to its top edge — FightStage drops its bar in then. Only
// flips a flag (checked once a frame while scrolling); nothing here moves
// with the scroll.

import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';

export function useScrolledPast(el: Ref<HTMLElement | null>, cover: () => number) {
  const past = ref(false);
  let queued = false;

  function check() {
    queued = false;
    const rect = el.value?.getBoundingClientRect();
    past.value = !!rect && rect.height > 0 && rect.bottom < cover();
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(check);
  }

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  });

  return past;
}
