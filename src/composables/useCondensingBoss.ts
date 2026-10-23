// Phones only (the single-column layout, max-width 820px): as the page
// scrolls, the boss panel condenses into a bar shaped exactly like the hero
// strip and both pin to the top, so every hit stays in view while ticking
// skills. The panel is sticky with a negative top — it scrolls up until only
// the compact bar's height is left — and the bar inside it is sticky at the
// top, so the browser keeps both in step with the scroll. This only reshapes
// the pieces on the bar to match how far the panel has collapsed (see
// condenseLayout for the choreography); it never moves them to follow the
// scroll, which on phones lands a frame late and makes the boss jitter.
// Desktop keeps its own pinned side column, so nothing here runs there.

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { condenseLayout, FULL_LAYOUT } from '../components/boss/condenseLayout';
import type { Box, CompactTargets } from '../components/boss/condenseLayout';
import { useThemeStore } from '../store/themeStore';

const PHONE = '(max-width: 820px)';
// Space kept above and below the boss's stat line in the condensed bar.
const STATS_GAP_TOP = 0;
const STATS_GAP_BOTTOM = 6;

/** The tallest height up to `avail` made of whole rows of the stat line (0 if not even one fits). */
function wholeRows(stats: HTMLElement | null, avail: number): number {
  const first = stats?.firstElementChild;
  if (!stats || !first) return 0;
  const row = first.getBoundingClientRect().height;
  const gap = parseFloat(getComputedStyle(stats).rowGap) || 0;
  const rows = Math.floor((avail + gap) / (row + gap));
  return rows > 0 ? rows * row + (rows - 1) * gap : 0;
}

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
  const pieces = () => ['.stage-wrap', '.sprite', '.boss-name', '.health-bar', '.stat-summary', '.hit-layer'].map(piece);

  function measure(): boolean {
    const hero = heroStrip.value;
    const bossName = piece('.boss-name');
    const heroName = hero?.querySelector('h2');
    if (!panel.value || !hero || !bossName || !heroName) return false;
    const stats = piece('.stat-summary');
    const base = hero.getBoundingClientRect();
    const rel = (el: Element | null): Box => {
      const r = el?.getBoundingClientRect() ?? new DOMRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    };
    const hp = rel(hero.querySelector('.health-bar'));
    // Themes may set the HP numbers above the bar or hang them under it, so
    // leave them room on whichever side they're on.
    const label = rel(hero.querySelector('.health-bar-label'));
    const height = hero.offsetHeight;
    const statsY = Math.max(hp.y + hp.h, label.y + label.h) + STATS_GAP_TOP;
    compact = {
      height,
      portrait: rel(hero.querySelector('.sprite-wrapper')),
      name: rel(heroName),
      hp,
      hpRise: Math.max(0, hp.y - label.y),
      nameScale: parseFloat(getComputedStyle(heroName).fontSize) / parseFloat(getComputedStyle(bossName).fontSize),
      stats: { y: statsY, h: wholeRows(stats, height - STATS_GAP_BOTTOM - statsY) },
    };
    panel.value.style.height = `${FULL_LAYOUT.height}px`;
    panel.value.style.top = `${compact.height - FULL_LAYOUT.height}px`;
    panel.value.style.setProperty('--compact-h', `${compact.height}px`);
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
    const [stage, sprite, name, hp, stats, hits] = pieces();
    if (!stage || !sprite || !name || !hp || !stats || !hits) return;
    const L = condenseLayout(p, el.clientWidth, name.offsetWidth, compact);

    el.style.setProperty('--p', String(p));
    Object.assign(stage.style, { left: `${L.stage.x}px`, top: `${L.stage.y}px`, width: `${L.stage.w}px`, height: `${L.stage.h}px` });
    Object.assign(sprite.style, { width: `${L.sprite}px`, height: `${L.sprite}px` });
    Object.assign(name.style, { left: `${L.name.x}px`, top: `${L.name.y}px`, transform: `scale(${L.name.scale})` });
    Object.assign(hp.style, { left: `${L.hp.x}px`, top: `${L.hp.y}px`, width: `${L.hp.w}px` });
    // Centered across the full panel, left-aligned (and clipped to whole rows) once condensed.
    Object.assign(stats.style, {
      left: `${L.stats.x}px`,
      right: 'auto',
      width: `${L.stats.w}px`,
      top: `${L.stats.y}px`,
      opacity: String(L.stats.opacity),
      height: p > 0.5 ? `${L.stats.h}px` : '',
      justifyContent: p > 0.5 ? 'flex-start' : '',
    });
    // Hits pop over the boss while it's big. Once condensed its portrait is
    // too small and busy to read them over, so they rise from the right end of
    // the HP bar instead (over the end of the name row), in a shorter hop that
    // stays on screen. The hit layer stays on the stage, so this is relative to it.
    if (p > 0.5) {
      hits.style.setProperty('--pop-left', `${L.hp.x + L.hp.w - L.stage.x}px`);
      hits.style.setProperty('--pop-top', `${L.hp.y - compact.hpRise - L.stage.y}px`);
      hits.style.setProperty('--pop-shift', '-100% -100%');
      hits.style.setProperty('--pop-rise', '-16px');
    } else {
      hits.style.cssText = '';
    }
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
