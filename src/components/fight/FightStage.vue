<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { bossSkillMarks, effectiveStat, heroClassFor, PERSONALITY_NAME } from '../../game-engine';
import { useCelebration } from '../../composables/useCelebration';
import { setHitPlayer, useHitFeed } from '../../composables/useHitFeed';
import { useScrolledPast } from '../../composables/useScrolledPast';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import BossBar from '../boss/BossBar.vue';
import BossPanel from '../boss/BossPanel.vue';
import { PERSONALITY_SPRITE } from '../boss/bossSprites';
import CharacterPanel from '../character/CharacterPanel.vue';
import { createHitPlayer } from './hitFx';

// The fight as one scene: the boss and the hero square off across one stage,
// each half its own panel with its own details. Hits play out across it
// (hitFx.ts), each fighter's HP held back until its blow lands.

const bossStore = useBossStore();
const characterStore = useCharacterStore();

// The slain boss stays up while a kill plays out, as on the stage.
const { phase, displayedBoss, heldLevel } = useCelebration();
const boss = computed(() => displayedBoss.value ?? bossStore.boss);

// The stage scrolls away with the page, and BossBar drops in once the whole
// stage has gone, carrying the hero's HP and level too (the level held back
// like the hero panel's until a level-up's beat plays).
const hero = computed(() => characterStore.character);
const heroLevel = computed(() => heldLevel.value ?? hero.value.level);
const heroMax = computed(() => effectiveStat(hero.value, 'health'));
const { shownHp } = useHitFeed();
const bossHp = computed(() => shownHp(boss.value.index, boss.value.health, boss.value.maxHealth));
const heroHp = computed(() => shownHp('hero', hero.value.currentHealth, heroMax.value));
const stage = ref<HTMLElement | null>(null);
const bar = ref<InstanceType<typeof BossBar> | null>(null);
const scrolledPast = useScrolledPast(stage, () => (bar.value?.$el as HTMLElement | undefined)?.offsetHeight ?? 0);

// Where the boss's and hero's blocks end on the stage, measured as drawn:
// their text grows with the system's text size, so the tap areas' step reads
// these to keep each block wholly on its own side (see .stage-inner's CSS).
const inner = ref<HTMLElement | null>(null);
const blockEdges = ref<Record<string, string>>({});
let blockObserver: ResizeObserver | null = null;

function measureBlocks() {
  const el = inner.value;
  const box = el?.getBoundingClientRect();
  const boss = el?.querySelector('.boss-block')?.getBoundingClientRect();
  const heroBlock = el?.querySelector('.hero-block')?.getBoundingClientRect();
  if (!box || !boss || !heroBlock || box.height === 0) return;
  blockEdges.value = { '--boss-bottom': `${boss.bottom - box.top}px`, '--hero-top': `${heroBlock.top - box.top}px` };
}

const fxLayer = ref<HTMLElement | null>(null);
const FIGURES = { boss: ['.boss-figure', '.sprite'], hero: ['.hero-figure', '.player-sprite'] } as const;

onMounted(() => {
  blockObserver = new ResizeObserver(() => requestAnimationFrame(measureBlocks));
  for (const el of [inner.value, inner.value?.querySelector('.boss-block'), inner.value?.querySelector('.hero-block')]) {
    if (el) blockObserver.observe(el);
  }
  measureBlocks();

  const layer = fxLayer.value;
  const stageEl = inner.value;
  if (!layer || !stageEl) return;
  setHitPlayer(
    createHitPlayer({
      layer,
      stage: stageEl,
      fighter: (who) => {
        const [figureSel, bodySel] = FIGURES[who];
        const figure = stageEl.querySelector<HTMLElement>(figureSel);
        const body = figure?.querySelector<HTMLElement>(bodySel);
        return figure && body ? { figure, body } : null;
      },
    }),
  );
});
onBeforeUnmount(() => {
  blockObserver?.disconnect();
  setHitPlayer(null);
});
</script>

<template>
  <section ref="stage" class="fight-stage">
    <div class="stage-bg" aria-hidden="true" />
    <div ref="inner" class="stage-inner" :style="blockEdges">
      <BossPanel />
      <CharacterPanel />
      <div ref="fxLayer" class="fx-layer" aria-hidden="true" />
    </div>

    <Teleport to="body">
      <BossBar
        ref="bar"
        :sprite="PERSONALITY_SPRITE[boss.personality]"
        :name="PERSONALITY_NAME[boss.personality]"
        :current="bossHp"
        :max="boss.maxHealth"
        :hero-class="heroClassFor(hero)"
        :hero-current="heroHp"
        :hero-max="heroMax"
        :hero-level="heroLevel"
        :shown="scrolledPast"
        :phase="phase"
        :marks="bossSkillMarks(boss)"
      />
    </Teleport>
  </section>
</template>

<style scoped>
/* Frameless: on phones the stage runs edge to edge (its fog, in Ashen), with
   the fighters held to a centred box no wider than a large phone. Clipped
   at the sides only, so a crit's jolt or a spark never scrolls the page
   sideways and the numbers can still rise off the top. */
.fight-stage {
  position: relative;
  overflow-x: clip;
}

/* Over the blocks, under the tap areas. */
.fx-layer {
  position: absolute;
  z-index: 5;
  inset: 0;
  pointer-events: none;
}

.stage-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Drawn at 390px wide; on narrower phones --u shrinks the art in proportion
   while text and the blocks' insets keep their px (the blocks keep their
   share of the width, so they never cover the art). The split is where the boss's and hero's tap
   areas meet, in a step that follows the diagonal; its left step rides the
   top of the hero, so a boss block that wraps deeper on a narrow phone stays
   on the boss's side. Each step also gives way, 4px clear, to a block that
   reaches past it (--boss-bottom, --hero-top: measured, larger text). */
.stage-inner {
  position: relative;
  width: min(100%, 430px);
  height: 300px;
  margin-inline: auto;
  container-type: inline-size;
  --u: min(1px, calc(100cqw / 390));
  --split-x: 50%;
  --split-yl: max(calc(300px - 178 * var(--u)), calc(var(--boss-bottom, 0px) + 4px));
  --split-yr: min(212px, calc(var(--hero-top, 999px) - 4px));
  /* A second step, for the banner; on phones it folds into the first. */
  --split-x2: var(--split-x);
  --split-ym: var(--split-yr);
}

@media (max-width: 820px) {
  .fight-stage {
    width: 100vw;
    margin-inline: calc(50% - 50vw);
  }
}

/* Desktop and tablet: a wide banner across the content, the same diagonal
   stretched out with each fighter 7% in from its edge. The boss's tap area is
   the rectangle from its block's left edge to the right, down to 212px, less
   a notch under its block for the hero's name where the two blocks overlap
   on narrower screens (none once the hero's block ends left of the boss's). */
@media (min-width: 821px) {
  .stage-inner {
    width: 100%;
    height: 290px;
    --u: 1px;
    --split-x: calc(93% - 516px);
    --split-yl: 0px;
    --split-yr: 212px;
    --split-x2: max(var(--split-x), calc(7% + 450px));
    --split-ym: min(186px, calc(var(--hero-top, 999px) - 4px));
  }
}
</style>

<style>
/* The pieces hitFx.ts lays on .fx-layer, made outside Vue's templates so
   unscoped. Each takes its colour from --c. */
.fx-layer .fx {
  position: absolute;
  display: block;
  pointer-events: none;
}

.fx-streak {
  background: linear-gradient(90deg, transparent, var(--c), #fff, var(--c), transparent);
  box-shadow: 0 0 12px var(--c);
}

.fx-spark {
  border-radius: 2px;
  background: linear-gradient(#fff, var(--c));
}

.fx-orb {
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 25%, var(--c) 55%, transparent 72%);
  box-shadow: 0 0 16px 3px color-mix(in srgb, var(--c) 55%, transparent);
}

.fx-ring {
  border-radius: 50%;
  border: 2px solid var(--c);
  box-shadow:
    0 0 10px var(--c),
    inset 0 0 10px var(--c);
}

.fx-mote {
  border-radius: 50%;
  background: #f0ffe6;
  box-shadow: 0 0 8px 2px var(--c);
}

.fx-beam {
  --soft: color-mix(in srgb, var(--c) 55%, transparent);
  background: linear-gradient(90deg, transparent, var(--soft) 30%, #fff 50%, var(--soft) 70%, transparent);
  box-shadow: 0 0 26px var(--soft);
}

.fx-layer .fx-wash {
  inset: 0;
  background: radial-gradient(ellipse 55% 75% at var(--x) var(--y), #fff, transparent 75%);
}

/* Lifesteal: a red thread, life running along it in green. */
.fx-thread {
  transform-origin: 0 50%;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--fx-lifesteal) 15%, transparent),
    var(--fx-lifesteal) 50%,
    color-mix(in srgb, var(--fx-lifesteal) 15%, transparent)
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--fx-lifesteal) 60%, transparent);
}

.fx-pulse {
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 25%, var(--dmg-healing) 55%, transparent 72%);
}

/* The numbers: outlined to read over the sprites' busy pixels. */
.fx-pop {
  position: absolute;
  color: var(--c);
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  text-shadow:
    0 0 2px #000,
    0 0 2px #000,
    0 1px 3px rgba(0, 0, 0, 0.8);
}

.fx-pop.crit {
  font-size: 2rem;
}

.fx-pop.small {
  font-size: 1.2rem;
}
</style>
