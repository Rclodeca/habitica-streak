<script setup lang="ts">
import { computed, ref } from 'vue';
import { bossMissDamage, damageReductionPct, effectiveResistAfterPen, itemBonusPercent, PERSONALITY_NAME } from '../../game-engine';
import type { Personality } from '../../game-engine';
import { useCondensingBoss } from '../../composables/useCondensingBoss';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import type { StatIconName } from '../ui/statIcons';
import Sprite from '../ui/Sprite.vue';

// Boss art from FreePixel (see CREDITS.md), picked to match each
// personality's emphasized stat and escalate within its family as
// PERSONALITY_NAME's flavor names climb in intensity (boss.ts) — every one
// of the 18 personalities has its own distinct sprite.
const PERSONALITY_SPRITE: Record<Personality, string> = {
  balanced: 'bosses/balanced',
  tank: 'bosses/tank',
  armored: 'bosses/armored',
  armored3x: 'bosses/armored3x',
  armored4x: 'bosses/armored4x',
  armored5x: 'bosses/armored5x',
  warded: 'bosses/warded',
  warded3x: 'bosses/warded3x',
  warded4x: 'bosses/warded4x',
  warded5x: 'bosses/warded5x',
  brute: 'bosses/brute',
  brute3x: 'bosses/brute3x',
  brute4x: 'bosses/brute4x',
  brute5x: 'bosses/brute5x',
  arcane: 'bosses/arcane',
  arcane3x: 'bosses/arcane3x',
  arcane4x: 'bosses/arcane4x',
  arcane5x: 'bosses/arcane5x',
};

const bossStore = useBossStore();
const characterStore = useCharacterStore();

const boss = computed(() => bossStore.boss);

const { popups, isHit } = useDamagePopup(() => bossStore.boss.health);

// On phones the panel condenses into a pinned bar as the page scrolls.
const panel = ref<HTMLElement | null>(null);
useCondensingBoss(panel);

// A condensed, always-visible emoji stat line (effective numbers only) sits
// under the HP bar; the full stats live in a modal behind the same tap. See CharacterPanel.vue for the same pattern.
const showDetails = ref(false);

const physicalAttack = computed(() => bossMissDamage(boss.value.physicalAttack));
const magicAttack = computed(() => bossMissDamage(boss.value.magicAttack));

// Damage reduction against the player's attacks, after the player's own
// armorPen/magicPen items shave the boss's resist stat (same math as
// completeHabit in combat.ts).
const armorReduction = computed(
  () => damageReductionPct(effectiveResistAfterPen(boss.value.armor, itemBonusPercent(characterStore.character, 'armorPen'))) * 100,
);
const magicResistReduction = computed(
  () => damageReductionPct(effectiveResistAfterPen(boss.value.magicResist, itemBonusPercent(characterStore.character, 'magicPen'))) * 100,
);

interface StatTile {
  icon: StatIconName;
  label: string;
  value: string;
  note?: string;
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

const statTiles = computed<StatTile[]>(() => {
  const b = boss.value;
  return [
    { icon: 'physical', label: 'Physical attack', value: physicalAttack.value.toFixed(0) },
    { icon: 'magic', label: 'Magic attack', value: magicAttack.value.toFixed(0) },
    { icon: 'armor', label: 'Armor', value: b.armor.toFixed(0), note: `${armorReduction.value.toFixed(1)}% less damage` },
    { icon: 'magicResist', label: 'Magic resist', value: b.magicResist.toFixed(0), note: `${magicResistReduction.value.toFixed(1)}% less damage` },
    { icon: 'crit', label: 'Crit chance', value: pct(b.critChance) },
    ...(b.reflectPct > 0 ? [{ icon: 'reflect' as const, label: 'Reflect', value: pct(b.reflectPct) }] : []),
    ...(b.lifestealPct > 0 ? [{ icon: 'lifesteal' as const, label: 'Lifesteal', value: pct(b.lifestealPct) }] : []),
    ...(b.woundsAbility
      ? [
          {
            icon: 'wounds' as const,
            label: 'Wounds chance',
            value: pct(b.woundsAbility.hitChance),
            note: `${pct(b.woundsAbility.effectRate)} healing for ${b.woundsAbility.durationDays}d`,
          },
        ]
      : []),
  ];
});
</script>

<template>
  <section ref="panel" class="panel boss-panel">
    <!-- Phones only: frames the condensing panel. It scrolls with the panel, so
         it also takes taps on the parts of the panel the bar doesn't cover. -->
    <div class="panel boss-frame" aria-hidden="true" @click="showDetails = true" />
    <button type="button" class="summary-row" @click="showDetails = true">
      <!-- Phones only: the frame's top edge, kept on screen with the bar (themes draw it). -->
      <div class="boss-cap" aria-hidden="true" />
      <div class="stage-wrap">
        <div class="sprite-wrapper" :class="{ hit: isHit }">
          <Sprite :image-name="PERSONALITY_SPRITE[boss.personality]" alt="Boss" />
        </div>
        <!-- Outside the stage so its clipping never cuts off a hit. -->
        <div class="hit-layer" aria-hidden="true">
          <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
        </div>
      </div>
      <div class="summary-info">
        <h2 class="boss-name">{{ PERSONALITY_NAME[boss.personality] }}</h2>
        <HealthBar :current="boss.health" :max="boss.maxHealth" variant="boss" />
        <p class="stat-summary">
          <span><StatIcon name="physical" /> {{ physicalAttack.toFixed(0) }}</span>
          <span><StatIcon name="magic" /> {{ magicAttack.toFixed(0) }}</span>
          <span><StatIcon name="armor" /> {{ boss.armor.toFixed(0) }}</span>
          <span><StatIcon name="magicResist" /> {{ boss.magicResist.toFixed(0) }}</span>
          <span><StatIcon name="crit" /> {{ (boss.critChance * 100).toFixed(0) }}%</span>
          <span v-if="boss.reflectPct > 0"><StatIcon name="reflect" /> {{ (boss.reflectPct * 100).toFixed(0) }}%</span>
          <span v-if="boss.lifestealPct > 0"><StatIcon name="lifesteal" /> {{ (boss.lifestealPct * 100).toFixed(0) }}%</span>
          <span v-if="boss.woundsAbility"><StatIcon name="wounds" /> {{ (boss.woundsAbility.hitChance * 100).toFixed(0) }}%</span>
        </p>
      </div>
    </button>

    <Modal v-model="showDetails" title="Boss" max-width="520px">
      <div class="hero">
        <div class="hero-sprite">
          <Sprite :image-name="PERSONALITY_SPRITE[boss.personality]" alt="Boss" />
        </div>
        <div class="hero-info">
          <span class="hero-tag">Boss #{{ boss.index }}</span>
          <span class="hero-name">{{ PERSONALITY_NAME[boss.personality] }}</span>
          <HealthBar :current="boss.health" :max="boss.maxHealth" variant="boss" />
        </div>
      </div>

      <section class="stat-group">
        <h4 class="group-label">Stats</h4>
        <div class="tiles">
          <div v-for="stat in statTiles" :key="stat.label" class="stat-tile">
            <span class="tile-label"><StatIcon :name="stat.icon" badge />{{ stat.label }}</span>
            <span class="tile-value">{{ stat.value }}</span>
            <span v-if="stat.note" class="tile-note">{{ stat.note }}</span>
          </div>
        </div>
        <p class="stat-note">
          Attack is what a missed medium daily deals. Easy ~0.67x, hard ~1.33x; a crit or missed weekly doubles it.
          Armor and magic resist show the reduction your attacks face after your pen items.
        </p>
      </section>
    </Modal>
  </section>
</template>

<style scoped>
.boss-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

/* The name tops out FULL_LAYOUT.nameOverlap (62px) above the stage's bottom
   edge, on its fog band; 0.6rem is .summary-row's gap. */
.summary-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: calc(-62px - 0.6rem);
}

/* Above the stage's fog band. */
.summary-info > * {
  position: relative;
  z-index: 2;
}

.summary-info h2 {
  margin: 0;
}

.stat-summary span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.stat-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 0.75rem;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-h);
}

/* The panel's stage again, across the top of the box, with the tag, name and
   HP bar on the fog at the boss's feet. */
.hero {
  position: relative;
  overflow: hidden;
  background: var(--code-bg);
  border: 1px solid color-mix(in srgb, var(--damage-color) 50%, transparent);
  border-radius: 12px;
  box-shadow: 0 0 18px -8px var(--damage-color);
}

.hero-sprite {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 226px;
  overflow: hidden;
  background: radial-gradient(ellipse 55% 58% at 50% 60%, color-mix(in srgb, var(--damage-color) 18%, transparent), transparent 72%);
}

.hero-sprite::after {
  content: '';
  position: absolute;
  z-index: 2;
  inset: auto 0 0;
  height: 45%;
  pointer-events: none;
  background: linear-gradient(0deg, var(--stage-fog, var(--code-bg)) 18%, transparent);
}

.hero-info {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: -58px 1rem 0;
  padding-bottom: 1rem;
  text-align: center;
}

/* Read over the boss's feet. */
.hero-tag,
.hero-name {
  text-shadow:
    0 0 6px #000,
    0 0 12px #000;
}

.hero-tag {
  color: var(--damage-color);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-name {
  color: var(--text-h);
  font-size: 1.2rem;
  font-weight: 600;
}

.stat-group {
  margin-top: 1rem;
}

.group-label {
  margin: 0 0 0.4rem;
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.5rem;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.7rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.tile-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text);
  font-size: 0.75rem;
}

.tile-value {
  color: var(--text-h);
  font-size: 1.25rem;
  font-weight: 600;
}

.tile-note {
  color: var(--text);
  font-size: 0.75rem;
}

.stat-note {
  margin: 0.6rem 0 0;
  font-size: 0.75rem;
  color: var(--text);
}

/* Full-bleed: the stage runs to the panel's edges (its padding is 1rem, see
   main.scss). Phones place it themselves, see the media query below. */
.stage-wrap {
  position: relative;
  width: calc(100% + 2rem);
  margin: -1rem -1rem 0;
}

/* The fog band the name and HP bar sit on (FULL_LAYOUT.fogBand). On phones it
   fades out as the bar condenses (--p, see useCondensingBoss), once they've
   slid clear of the stage. */
.stage-wrap::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: auto 0 0;
  height: 45%;
  pointer-events: none;
  background: linear-gradient(0deg, var(--stage-fog, var(--code-bg)) 18%, transparent);
  opacity: clamp(0, (0.55 - var(--p, 0)) / 0.15, 1);
}

/* FULL_LAYOUT.stageH tall. */
.sprite-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 230px;
  overflow: hidden;
  border-radius: 13px 13px 0 0;
}

/* At its file size, 2 screen px per art pixel like the gear icons, with their
   dark rim and a glow, in the boss's damage colour. Phones size it inline. */
.sprite-wrapper :deep(.sprite),
.hero-sprite :deep(.sprite) {
  --rim: color-mix(in srgb, var(--damage-color) 20%, #000);
  width: 200px;
  height: 200px;
  margin-bottom: 6px;
  image-rendering: pixelated;
  filter:
    drop-shadow(2px 0 0 var(--rim))
    drop-shadow(-2px 0 0 var(--rim))
    drop-shadow(0 2px 0 var(--rim))
    drop-shadow(0 -2px 0 var(--rim))
    drop-shadow(0 0 12px color-mix(in srgb, var(--damage-color) 35%, transparent));
}

.sprite-wrapper.hit :deep(.sprite) {
  animation: sprite-shake 0.3s ease;
}

/* Above the name and HP bar, which hits can rise past on the phone bar. */
.hit-layer {
  position: absolute;
  z-index: 3;
  inset: 0;
  pointer-events: none;
}

.boss-frame,
.boss-cap {
  display: none;
}

/* Big, outlined and held before it fades, so it reads over the sprite's busy
   pixels. Centered on the stage; the condensed phone bar moves it (and
   shortens its rise) through the --pop-* properties (useCondensingBoss). */
.damage-popup {
  position: absolute;
  top: var(--pop-top, 35%);
  left: var(--pop-left, 50%);
  translate: var(--pop-shift, -50% 0);
  color: var(--hp-color);
  font-weight: 800;
  font-size: 1.25rem;
  line-height: 1;
  white-space: nowrap;
  text-shadow:
    0 0 2px #000,
    0 0 2px #000,
    0 1px 3px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  animation: damage-float-fade 1.2s ease-out forwards;
}

/* Phones: the panel condenses into a bar pinned to the top as the page
   scrolls (useCondensingBoss sets the height, sticky top, --compact-h and
   each piece's position). It keeps a fixed height and is framed by
   .boss-frame, so the section itself draws nothing. */
@media (max-width: 820px) {
  .boss-panel {
    position: sticky;
    z-index: 5;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    /* Nothing may spill past the bottom edge mid-collapse. */
    clip-path: inset(-10px -10px 0 -10px);
  }

  .boss-frame {
    display: block;
    position: absolute;
    inset: 0;
    padding: 0;
  }

  /* The bar the pieces sit on. It's sticky too, so the browser holds it at
     the top of the screen while the panel scrolls up beneath it — JS that
     chased the scroll instead landed a frame late on phones, and the boss
     jittered. */
  .summary-row {
    position: sticky;
    top: 0;
    display: block;
    height: var(--compact-h, 0px);
  }

  .boss-cap {
    position: absolute;
    top: 0;
    left: 1px;
    right: 1px;
    height: calc(var(--compact-h, 0px) - 1px);
  }

  .stage-wrap,
  .summary-info > * {
    position: absolute;
    margin: 0;
  }

  .summary-info {
    margin-top: 0;
  }

  /* Border included, so it fits the stage exactly (and ends exactly on the
     hero portrait, which the stage copies) rather than poking out past the
     fog band. */
  .sprite-wrapper {
    box-sizing: border-box;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Grows into the hero portrait's border as it condenses. */
    border: 1px solid color-mix(in srgb, var(--portrait-border) calc(var(--p, 0) * 100%), transparent);
    border-radius: calc(13px - var(--p, 0) * 5px);
  }

  .sprite-wrapper :deep(.sprite) {
    margin-bottom: 3px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .summary-info h2 {
    white-space: nowrap;
    transform-origin: left top;
  }

  /* Once condensed the stat line is clipped to whole rows (useCondensingBoss);
     whatever doesn't fit under the HP bar is cut off, and rows stay packed at
     the top when there's room to spare. */
  .stat-summary {
    left: 14px;
    right: 14px;
    overflow: hidden;
    align-content: flex-start;
  }
}

@keyframes sprite-shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(3px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-4px);
  }
  40%,
  60% {
    transform: translateX(4px);
  }
}

/* Pops in, holds, then rises as it fades. */
@keyframes damage-float-fade {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.7);
  }
  12% {
    opacity: 1;
    transform: translateY(0) scale(1.15);
  }
  24% {
    transform: translateY(-4px) scale(1);
  }
  65% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(var(--pop-rise, -36px)) scale(1);
  }
}
</style>
