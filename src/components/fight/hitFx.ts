// Plays hits on the fight stage (FightStage). Each damage type arrives its
// own way (option A of docs/mockups/hit-types.html): a physical blow lunges
// and cuts, magic is cast and flies, true damage falls from above as a beam,
// and a heal lifts motes. Lifesteal and reflect follow the blow as in
// docs/mockups/hit-lifesteal-reflect.html ("Thread and echo"): a red thread
// carries green pulses of life to the attacker, and a reflect sends a smaller,
// steel copy of the hero's own blow back at them.
//
// The pieces are short-lived elements on one layer over the stage, moved
// only by transform, opacity, clip-path and filter (no blur), so they stay
// cheap on a mid-range Android WebView. Under reduced motion only the numbers
// show, each landing at once.
//
// Every land runs on a timer, never on an animation ending, so the HP holds
// (useHitFeed) are always let go, even where Element.animate is missing
// (jsdom) or the stage has gone.

import { holdHp } from '../../composables/useHitFeed';
import { formatCompact } from '../../game-engine';
import type { Fighter, Hit, HitPlayer, StrikeType } from '../../composables/useHitFeed';

export interface StageParts {
  /** Holds the pieces and the numbers; laid over the whole stage. */
  layer: HTMLElement;
  /** Jolts on a crit. */
  stage: HTMLElement;
  /** A fighter's figure (it lunges and flashes) and the body inside it (it shakes). */
  fighter: (who: Fighter) => { figure: HTMLElement; body: HTMLElement } | null;
}

// When each blow lands after it starts: physical's lunge connects; magic is
// cast, then flies; true damage glints, then its beam falls.
const CAST_MS = 180;
const FLIGHT_MS = 300;
const GLINT_MS = 150;
const BEAM_DROP_MS = 90;
export const IMPACT_MS: Record<StrikeType, number> = {
  physical: 130,
  magic: CAST_MS + FLIGHT_MS,
  trueDamage: GLINT_MS + BEAM_DROP_MS,
};
export const HEAL_MS = 160;
// After the blow: a reflect's echo lands, and lifesteal's pulses set off
// (after the echo, if there is one) and arrive.
export const REFLECT_MS = 200;
const REFLECT_BEAM_MS = 70;
export const STEAL_AFTER_REFLECT_MS = 240;
export const STEAL_ALONE_MS = 100;
export const BOSS_STEAL_MS = 120;
export const STEAL_FLIGHT_MS = 480;
// Back-to-back hits (a rollover's misses) start at least this far apart.
export const HIT_GAP_MS = 450;
// A crit holds the struck fighter white before it shakes.
const HIT_STOP_MS = 90;

const COLOR: Record<StrikeType | 'heal' | 'hurt', string> = {
  physical: 'var(--dmg-physical)',
  magic: 'var(--dmg-magic)',
  trueDamage: 'var(--dmg-true)',
  heal: 'var(--dmg-healing)',
  hurt: 'var(--hp-color)',
};
const STEEL = 'var(--fx-reflect)';

// Filters run from the first to the second; hue-rotate ends at a full turn
// so the violet fades out through magenta, never green.
const WHITE = ['brightness(3) saturate(0)', 'brightness(1) saturate(1)'];
const VIOLET = ['brightness(1.7) sepia(1) hue-rotate(215deg) saturate(2.6)', 'brightness(1) sepia(0) hue-rotate(360deg) saturate(1)'];
const HOT = ['brightness(4) saturate(0) contrast(1.6)', 'brightness(1) saturate(1) contrast(1)'];
const GLOW = { violet: 'rgba(171, 141, 216, 0.95)', bone: 'rgba(241, 233, 214, 0.9)', green: 'rgba(146, 191, 136, 0.95)' };

interface Box {
  figure: HTMLElement;
  body: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  feet: number;
}

// One keyframe, as Element.animate takes it.
type Frame = Record<string, string | number>;

interface PopOptions {
  dx?: number;
  dy?: number;
  size?: 'crit' | 'small';
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** One hit's view of the stage: its pieces, its fighters and its clock. */
class Scene {
  private readonly parts: StageParts;
  private readonly canAnimate: boolean;
  readonly reduced: boolean;
  readonly crit: boolean;

  constructor(parts: StageParts, reduced: boolean, crit: boolean) {
    this.parts = parts;
    this.reduced = reduced;
    this.crit = crit;
    this.canAnimate = typeof parts.layer.animate === 'function';
  }

  /** Pieces and moves play only with motion on, on a stage still showing. */
  private get moving() {
    return this.canAnimate && !this.reduced && this.parts.layer.isConnected;
  }

  wait(ms: number): Promise<void> {
    return this.reduced ? Promise.resolve() : sleep(ms);
  }

  box(who: Fighter): Box | null {
    const f = this.parts.fighter(who);
    if (!f || !this.parts.layer.isConnected) return null;
    const layer = this.parts.layer.getBoundingClientRect();
    const r = f.figure.getBoundingClientRect();
    const x = r.left - layer.left;
    const y = r.top - layer.top;
    return { ...f, x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2, feet: y + r.height * 0.93 };
  }

  // Temporary pieces remove themselves; a fighter's own element (`keep`) is
  // animated in place and left as it was.
  private anim(el: Element, frames: Frame[], ms: number, o: { delay?: number; ease?: string; keep?: boolean } = {}) {
    const a = el.animate(frames, { duration: ms, delay: o.delay ?? 0, easing: o.ease ?? 'ease-out', fill: o.keep ? 'none' : 'both' });
    if (!o.keep) a.onfinish = () => el.remove();
  }

  private piece(cls: string, x: number, y: number, w: number, h: number, color?: string): HTMLElement {
    const el = document.createElement('i');
    el.className = `fx ${cls}`;
    Object.assign(el.style, { left: `${x - w / 2}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px` });
    if (color) el.style.setProperty('--c', color);
    this.parts.layer.appendChild(el);
    return el;
  }

  /** A number rising off a fighter: shown even under reduced motion, where it only fades. */
  pop(on: Box | null, amount: number, sign: string, color: string, o: PopOptions = {}) {
    const n = Math.round(amount);
    if (!on || n <= 0 || !this.canAnimate || !this.parts.layer.isConnected) return;
    const el = document.createElement('span');
    el.className = `fx-pop${o.size ? ` ${o.size}` : ''}`;
    el.style.setProperty('--c', color);
    el.textContent = `${sign}${formatCompact(n)}${o.size === 'crit' ? '!' : ''}`;
    Object.assign(el.style, { left: `${on.cx + (o.dx ?? 0)}px`, top: `${on.y + on.h * 0.16 + (o.dy ?? 0)}px` });
    this.parts.layer.appendChild(el);
    const frames: Frame[] = this.reduced
      ? [{ opacity: 0, transform: 'translateX(-50%)' }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'translateX(-50%)' }]
      : [
          { opacity: 0, transform: 'translate(-50%, 6px) scale(0.6)' },
          { opacity: 1, transform: 'translate(-50%, -4px) scale(1.15)', offset: 0.15 },
          { opacity: 1, transform: 'translate(-50%, -8px) scale(1)', offset: 0.3 },
          { opacity: 0, transform: 'translate(-50%, -40px) scale(1)' },
        ];
    this.anim(el, frames, this.reduced ? 1200 : 1000);
  }

  // ---------- Moves ----------

  lunge(a: Box | null, t: Box | null, d: number) {
    if (!this.moving || !a || !t) return;
    const L = Math.hypot(t.cx - a.cx, t.cy - a.cy) || 1;
    const to = `translate(${((t.cx - a.cx) / L) * d}px, ${((t.cy - a.cy) / L) * d}px) scale(1.04)`;
    this.anim(a.figure, [{ transform: 'translate(0, 0) scale(1)' }, { transform: to, offset: 0.4 }, { transform: 'translate(0, 0) scale(1)' }], 320, { keep: true });
  }

  /** The struck fighter flashes and shakes; a crit holds the flash first and jolts the stage. */
  impact(t: Box | null, tint: string[], amp: number, crit = this.crit) {
    if (!this.moving || !t) return;
    const hold = crit ? HIT_STOP_MS : 0;
    const ms = 400 + hold;
    const frames: Frame[] = [{ filter: tint[0] }, ...(hold ? [{ filter: tint[0], offset: hold / ms }] : []), { filter: tint[1] }];
    this.anim(t.figure, frames, ms, { keep: true });
    if (amp) {
      const a = crit ? amp * 1.6 : amp;
      this.anim(t.body, [0, -a, 0.8 * a, -0.4 * a, 0].map((v) => ({ transform: `translateX(${v}px)` })), 400, { keep: true, delay: hold });
    }
    if (crit) {
      this.anim(this.parts.stage, [0, -3, 3, -2, 0].map((v) => ({ transform: `translate(${v}px, ${-v / 2}px)` })), 300, { keep: true, delay: hold });
    }
  }

  glow(f: Box | null, color: string, ms: number) {
    if (!this.moving || !f) return;
    const off = 'drop-shadow(0 0 0px transparent) brightness(1)';
    this.anim(f.figure, [{ filter: off }, { filter: `drop-shadow(0 0 14px ${color}) brightness(1.35)`, offset: 0.4 }, { filter: off }], ms, { keep: true });
  }

  wobble(t: Box | null) {
    if (!this.moving || !t) return;
    this.anim(
      t.figure,
      [
        { transform: 'scale(1) skewX(0deg)' },
        { transform: 'scale(1.05, 0.96) skewX(-3deg)', offset: 0.25 },
        { transform: 'scale(0.97, 1.03) skewX(2deg)', offset: 0.55 },
        { transform: 'scale(1) skewX(0deg)' },
      ],
      460,
      { keep: true },
    );
  }

  nudge(t: Box | null, dx: number, dy: number, ms: number) {
    if (!this.moving || !t) return;
    this.anim(t.figure, [{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)`, offset: 0.3 }, { transform: 'translate(0, 0)' }], ms, { keep: true });
  }

  // ---------- Pieces ----------

  streak(x: number, y: number, w: number, h: number, deg: number, color: string, ms: number, delay = 0) {
    if (!this.moving) return;
    const el = this.piece('fx-streak', x, y, w, h, color);
    el.style.transform = `rotate(${deg}deg)`;
    this.anim(el, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, clipPath: 'inset(0 0 0 0)' }], ms, { delay });
  }

  sparks(x: number, y: number, n: number, color: string, dist: number, len: number) {
    if (!this.moving) return;
    for (let i = 0; i < n; i++) {
      const el = this.piece('fx-spark', x, y, 3, len, color);
      const ang = (360 / n) * i + Math.random() * 30;
      const d = dist * (0.6 + Math.random() * 0.6);
      this.anim(
        el,
        [
          { opacity: 1, transform: `rotate(${ang}deg) translateY(0) scaleY(1.2)` },
          { opacity: 0, transform: `rotate(${ang}deg) translateY(${-d}px) scaleY(0.3)` },
        ],
        380,
        { ease: 'cubic-bezier(.2, .7, .3, 1)' },
      );
    }
  }

  ring(x: number, y: number, w: number, h: number, color: string, ms: number, delay = 0) {
    if (!this.moving) return;
    const el = this.piece('fx-ring', x, y, w, h, color);
    this.anim(el, [{ opacity: 1, transform: 'scale(0.15)' }, { opacity: 0, transform: 'scale(1)' }], ms, { delay });
  }

  /** Light falling from the top of the stage onto a fighter. */
  beam(t: Box | null, color: string, w: number, ms: number) {
    if (!this.moving || !t) return;
    const bottom = t.y + t.h * 0.82;
    const el = this.piece('fx-beam', t.cx, bottom / 2, w, bottom, color);
    this.anim(
      el,
      [
        { opacity: 0, transform: 'scaleX(0.15)', clipPath: 'inset(0 0 100% 0)' },
        { opacity: 1, transform: 'scaleX(1)', clipPath: 'inset(0 0 0 0)', offset: 0.22 },
        { opacity: 0, transform: 'scaleX(0.05)', clipPath: 'inset(0 0 0 0)' },
      ],
      ms,
    );
  }

  /** A soft white bloom around a point, over the whole stage. */
  wash(x: number, y: number) {
    if (!this.moving) return;
    const el = document.createElement('i');
    el.className = 'fx fx-wash';
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    this.parts.layer.appendChild(el);
    this.anim(el, [{ opacity: 0.35 }, { opacity: 0 }], 240);
  }

  orbs(a: Box | null, t: Box | null, color: string) {
    if (!this.moving || !a || !t) return;
    const sx = a.cx + (t.cx - a.cx) * 0.2;
    const sy = a.cy + (t.cy - a.cy) * 0.2;
    for (let i = 0; i < 3; i++) {
      const el = this.piece('fx-orb', sx, sy, 18 - i * 5, 18 - i * 5, color);
      const op = 1 - i * 0.3;
      this.anim(el, [{ opacity: op, transform: 'translate(0, 0)' }, { opacity: op, transform: `translate(${t.cx - sx}px, ${t.cy - sy}px)` }], FLIGHT_MS, {
        delay: i * 35,
        ease: 'cubic-bezier(.5, 0, .9, .6)',
      });
    }
  }

  motes(f: Box | null, n: number, color: string) {
    if (!this.moving || !f) return;
    for (let i = 0; i < n; i++) {
      const el = this.piece('fx-mote', f.x + f.w * (0.22 + Math.random() * 0.56), f.feet - Math.random() * f.h * 0.25, 5, 5, color);
      const d = 100 * (0.75 + Math.random() * 0.5);
      this.anim(el, [{ opacity: 0, transform: 'translateY(0)' }, { opacity: 1, offset: 0.2 }, { opacity: 0, transform: `translateY(${-d}px)` }], 900, { delay: i * 55 });
    }
  }

  /** A red thread drawn from one fighter to the other, with green pulses running along it. */
  thread(from: Box | null, to: Box | null) {
    if (!this.moving || !from || !to) return;
    const len = Math.hypot(to.cx - from.cx, to.cy - from.cy);
    const deg = (Math.atan2(to.cy - from.cy, to.cx - from.cx) * 180) / Math.PI;
    const line = this.piece('fx-thread', from.cx + len / 2, from.cy, len, 2);
    Object.assign(line.style, { left: `${from.cx}px`, transform: `rotate(${deg}deg)` });
    this.anim(
      line,
      [
        { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, clipPath: 'inset(0 0 0 0)', offset: 0.25 },
        { opacity: 1, offset: 0.75 },
        { opacity: 0, clipPath: 'inset(0 0 0 100%)' },
      ],
      620,
    );
    for (let i = 0; i < 3; i++) {
      const p = this.piece('fx-pulse', from.cx, from.cy, 9, 9);
      this.anim(
        p,
        [
          { opacity: 0, transform: 'translate(0, 0)' },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.85 },
          { opacity: 0, transform: `translate(${to.cx - from.cx}px, ${to.cy - from.cy}px)` },
        ],
        360,
        { delay: 120 + i * 80, ease: 'ease-in' },
      );
    }
  }
}

// ---------- The blows ----------

/** Plays the attacker's blow on the target; resolves the moment it lands. */
async function blow(s: Scene, type: StrikeType, a: Box | null, t: Box | null, color: string, land: () => void) {
  if (type === 'physical') {
    s.lunge(a, t, 22);
    await s.wait(IMPACT_MS.physical);
    if (t) {
      const y = t.cy - t.h * 0.05;
      s.streak(t.cx, y, t.w * 1.05, 4, -32, color, 300);
      s.streak(t.cx, y, t.w * 1.05, 4, 32, color, 300, 80);
      s.sparks(t.cx, y, 8, color, 46, 10);
    }
    s.impact(t, WHITE, 6);
  } else if (type === 'magic') {
    s.glow(a, GLOW.violet, 520);
    await s.wait(CAST_MS);
    s.orbs(a, t, color);
    await s.wait(FLIGHT_MS);
    if (t) {
      s.ring(t.cx, t.cy, t.w * 0.9, t.w * 0.9, color, 460);
      s.ring(t.cx, t.cy, t.w * 0.5, t.w * 0.5, color, 460, 90);
      s.sparks(t.cx, t.cy, 6, color, 34, 4);
    }
    s.impact(t, VIOLET, 0);
    s.wobble(t);
  } else {
    s.glow(a, GLOW.bone, 360);
    await s.wait(GLINT_MS);
    s.beam(t, color, 32, 440);
    await s.wait(BEAM_DROP_MS);
    if (t) {
      s.wash(t.cx, t.cy);
      s.ring(t.cx, t.feet, t.w * 1.2, 26, color, 500);
    }
    // Still: no shake, just a press into the ground.
    s.impact(t, HOT, 0);
    s.nudge(t, 0, 5, 380);
  }
  land();
}

/** The boss turns part of the hero's blow back: a steel ring, then a smaller steel copy of the blow on the hero. */
async function reflect(s: Scene, type: StrikeType, boss: Box | null, hero: Box | null, land: () => void) {
  if (boss) s.ring(boss.cx, boss.cy, boss.w * 1.05, boss.w * 1.05, STEEL, 420);
  await s.wait(REFLECT_MS);
  if (hero) {
    if (type === 'physical') {
      s.streak(hero.cx, hero.cy, hero.w * 0.75, 3, -32, STEEL, 260);
      s.streak(hero.cx, hero.cy, hero.w * 0.75, 3, 32, STEEL, 260, 60);
    } else if (type === 'magic') {
      s.ring(hero.cx, hero.cy, hero.w * 0.6, hero.w * 0.6, STEEL, 400);
    }
  }
  if (type === 'trueDamage') {
    s.beam(hero, STEEL, 18, 340);
    await s.wait(REFLECT_BEAM_MS);
  }
  s.impact(hero, WHITE, 3, false);
  land();
}

/** Life drawn along a thread from `from` to `to`, landing as a green glow. */
async function steal(s: Scene, from: Box | null, to: Box | null, land: () => void) {
  s.thread(from, to);
  await s.wait(STEAL_FLIGHT_MS);
  s.glow(to, GLOW.green, 520);
  land();
}

async function play(s: Scene, hit: Hit, release: Record<string, () => void>) {
  const hero = s.box('hero');
  if (hit.kind === 'hurt') {
    s.impact(hero, WHITE, 5);
    release.main();
    s.pop(hero, hit.amount, '−', COLOR.hurt);
    return;
  }
  if (hit.kind === 'heal') {
    s.glow(hero, GLOW.green, 760);
    if (hero) s.ring(hero.cx, hero.feet, hero.w * 1.1, 24, COLOR.heal, 600);
    s.motes(hero, 9, COLOR.heal);
    await s.wait(HEAL_MS);
    release.main();
    s.pop(hero, hit.amount, '+', COLOR.heal);
    return;
  }

  const boss = s.box('boss');
  const byHero = hit.by === 'hero';
  const [a, t] = byHero ? [hero, boss] : [boss, hero];
  // The boss's physical cut on the hero stays red, as in the mocks.
  const color = !byHero && hit.type === 'physical' ? 'var(--fx-boss-cut)' : COLOR[hit.type];
  await blow(s, hit.type, a, t, color, () => {
    release.main();
    // The hero's blows show bare numbers; the boss's carry a minus.
    s.pop(t, hit.amount, byHero ? '' : '−', COLOR[hit.type], { size: hit.crit ? 'crit' : undefined });
  });

  const { lifesteal, reflect: back } = hit;
  const follow: Promise<void>[] = [];
  if (back) {
    follow.push(
      reflect(s, hit.type, boss, hero, () => {
        release.reflect();
        s.pop(hero, back.amount, '−', STEEL, { size: 'small', dx: -26 });
      }),
    );
  }
  if (lifesteal) {
    // Numbers sit either side of the head, so a reflect's and a steal's never stack.
    const stealing = async () => {
      await s.wait(byHero ? (back ? STEAL_AFTER_REFLECT_MS : STEAL_ALONE_MS) : BOSS_STEAL_MS);
      await steal(s, t, a, () => {
        release.lifesteal();
        s.pop(a, lifesteal.amount, '+', COLOR.heal, { size: 'small', dx: 30, dy: byHero ? 10 : 0 });
      });
    };
    follow.push(stealing());
  }
  await Promise.all(follow);
}

/** Holds each change the hit makes, to be let go as its part lands. */
function holdParts(hit: Hit): Record<string, () => void> {
  if (hit.kind !== 'strike') return { main: holdHp('hero', hit.hp) };
  const bossKey = hit.bossIndex;
  const attacker = hit.by === 'hero' ? 'hero' : bossKey;
  return {
    main: holdHp(hit.by === 'hero' ? bossKey : 'hero', hit.hp),
    reflect: holdHp('hero', hit.reflect?.hp ?? 0),
    lifesteal: holdHp(attacker, hit.lifesteal?.hp ?? 0),
  };
}

/**
 * A HitPlayer for this stage: each hit starts once the one before has had
 * HIT_GAP_MS, its HP held back from the moment it's sent until it lands.
 */
export function createHitPlayer(parts: StageParts): HitPlayer {
  let nextStart = 0;
  return (hit) => {
    const now = Date.now();
    const delay = Math.max(0, nextStart - now);
    nextStart = now + delay + HIT_GAP_MS;
    const reduced = prefersReducedMotion();
    const release = holdParts(hit);
    setTimeout(() => {
      const scene = new Scene(parts, reduced, hit.kind === 'strike' && hit.crit);
      // Whatever happens on the stage, nothing stays held once the hit is over.
      play(scene, hit, release)
        .catch(() => {})
        .finally(() => Object.values(release).forEach((letGo) => letGo()));
    }, delay);
    if (reduced) return delay;
    return delay + (hit.kind === 'strike' ? IMPACT_MS[hit.type] : hit.kind === 'heal' ? HEAL_MS : 0);
  };
}
