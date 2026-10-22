// Phones only (the single-column layout, max-width 820px): as the page
// scrolls, the boss panel condenses into a bar shaped exactly like the hero
// strip and both pin to the top, so every hit stays in view while ticking
// skills. The panel is sticky with a negative top — it scrolls up until only
// the compact bar's height is left — and this just moves the pieces inside it
// to match how far it has collapsed (see condenseLayout for the choreography).
// Desktop keeps its own pinned side column, so nothing here runs there.

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { condenseLayout, FULL_LAYOUT } from '../components/boss/condenseLayout';
import type { Box, CompactTargets } from '../components/boss/condenseLayout';
import { useThemeStore } from '../store/themeStore';

const PHONE = '(max-width: 820px)';

// CharacterPanel's root registers itself here so the boss bar can copy its geometry.
const heroStrip = ref<HTMLElement | null>(null);

export function useHeroStrip() {
  return heroStrip;
}

/** Drives the condensing boss panel rooted at `panel` (BossPanel's section). */
export function useCondensingBoss(panel: Ref<HTMLElement | null>) {
  const themeStore = useThemeStore();
  let media: MediaQueryList | null = null;
  let compact: CompactTargets | null = null;
  let queued = false;
  let resizeObserver: ResizeObserver | null = null;

  const piece = (selector: string) => panel.value?.querySelector<HTMLElement>(selector) ?? null;
  const pieces = () => ['.stage-wrap', '.sprite', '.boss-name', '.health-bar', '.stat-summary'].map(piece);

  function measure(): boolean {
    const hero = heroStrip.value;
    const bossName = piece('.boss-name');
    const heroName = hero?.querySelector('h2');
    if (!panel.value || !hero || !bossName || !heroName) return false;
    const base = hero.getBoundingClientRect();
    const rel = (el: Element | null): Box => {
      const r = el?.getBoundingClientRect() ?? new DOMRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    };
    compact = {
      height: hero.offsetHeight,
      portrait: rel(hero.querySelector('.sprite-wrapper')),
      name: rel(heroName),
      hp: rel(hero.querySelector('.health-bar')),
      nameScale: parseFloat(getComputedStyle(heroName).fontSize) / parseFloat(getComputedStyle(bossName).fontSize),
    };
    panel.value.style.height = `${FULL_LAYOUT.height}px`;
    panel.value.style.top = `${compact.height - FULL_LAYOUT.height}px`;
    // Overlaps the boss bar's bottom border by 1px so the two read as one header.
    hero.style.top = `${compact.height - 1}px`;
    return true;
  }

  function place() {
    queued = false;
    const el = panel.value;
    if (!el || !compact || !media?.matches) return;
    const collapse = FULL_LAYOUT.height - compact.height;
    const off = Math.min(collapse, Math.max(0, -el.getBoundingClientRect().top));
    const p = collapse > 0 ? off / collapse : 0;
    const [stage, sprite, name, hp, stats] = pieces();
    if (!stage || !sprite || !name || !hp || !stats) return;
    const L = condenseLayout(p, el.clientWidth, name.offsetWidth, compact);

    el.style.setProperty('--p', String(p));
    el.style.setProperty('--frame-top', `${off}px`);
    Object.assign(stage.style, { left: `${L.stage.x}px`, top: `${off + L.stage.y}px`, width: `${L.stage.w}px`, height: `${L.stage.h}px` });
    Object.assign(sprite.style, { width: `${L.sprite}px`, height: `${L.sprite}px` });
    Object.assign(name.style, { left: `${L.name.x}px`, top: `${off + L.name.y}px`, transform: `scale(${L.name.scale})` });
    Object.assign(hp.style, { left: `${L.hp.x}px`, top: `${off + L.hp.y}px`, width: `${L.hp.w}px` });
    Object.assign(stats.style, { top: `${off + L.stats.y}px`, opacity: String(L.stats.opacity) });
  }

  // Back to the plain layout (desktop, or on the way out). None of these
  // elements carry inline styles of their own.
  function reset() {
    for (const el of [panel.value, heroStrip.value, ...pieces()]) {
      if (el) el.style.cssText = '';
    }
    compact = null;
  }

  function apply() {
    if (media?.matches && measure()) place();
    else reset();
  }

  function onScroll() {
    if (!media?.matches || queued) return;
    queued = true;
    requestAnimationFrame(place);
  }

  onMounted(() => {
    media = window.matchMedia?.(PHONE) ?? null;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', apply);
    media?.addEventListener('change', apply);
    requestAnimationFrame(apply);
    document.fonts?.ready.then(apply);
  });

  // Fonts and spacing differ per theme, and the hero strip may mount after us
  // or change size (e.g. a longer name wrapping).
  watch(
    heroStrip,
    (hero) => {
      resizeObserver?.disconnect();
      if (!hero) return;
      resizeObserver = new ResizeObserver(() => requestAnimationFrame(apply));
      resizeObserver.observe(hero);
    },
    { immediate: true },
  );
  watch(
    () => themeStore.theme,
    () => nextTick(() => requestAnimationFrame(apply)),
  );

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', apply);
    media?.removeEventListener('change', apply);
    resizeObserver?.disconnect();
    reset();
  });
}
