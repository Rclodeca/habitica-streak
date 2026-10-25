<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  bossMissDamage,
  damageReductionPct,
  effectiveResistAfterPen,
  effectiveStat,
  heroClassFor,
  itemBonusPercent,
  PERSONALITY_NAME,
} from '../../game-engine';
import { useCelebration } from '../../composables/useCelebration';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useScrolledPast } from '../../composables/useScrolledPast';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import BossBar from './BossBar.vue';
import { PERSONALITY_SPRITE } from './bossSprites';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import type { StatIconName } from '../ui/statIcons';
import Sprite from '../ui/Sprite.vue';

const bossStore = useBossStore();
const characterStore = useCharacterStore();

// While a kill plays out, the slain boss stays on the stage (at 0 HP, so the
// killing blow's hit still shows) until the next one rises in its place.
const { phase, displayedBoss, heldLevel } = useCelebration();
const boss = computed(() => displayedBoss.value ?? bossStore.boss);

const { popups, isHit } = useDamagePopup(() => boss.value.health);

// On phones the panel scrolls away with the page, and BossBar drops in once
// it's gone, carrying the hero's HP and level too (the level held back like
// the hero panel's until a level-up's beat plays).
const hero = computed(() => characterStore.character);
const heroLevel = computed(() => heldLevel.value ?? hero.value.level);
const panel = ref<HTMLElement | null>(null);
const bar = ref<InstanceType<typeof BossBar> | null>(null);
const scrolledPast = useScrolledPast(panel, () => (bar.value?.$el as HTMLElement | undefined)?.offsetHeight ?? 0);

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
    <button type="button" class="summary-row" @click="showDetails = true">
      <div class="stage-wrap">
        <div class="sprite-wrapper" :class="{ hit: isHit, dying: phase === 'dying', arriving: phase === 'arriving' }">
          <Sprite :image-name="PERSONALITY_SPRITE[boss.personality]" alt="Boss" />
          <template v-if="phase === 'dying'">
            <span class="death-flash" aria-hidden="true" />
            <span class="death-sparks" aria-hidden="true" />
          </template>
        </div>
        <!-- Outside the stage so its clipping never cuts off a hit. -->
        <div class="hit-layer" aria-hidden="true">
          <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
        </div>
        <div v-if="phase === 'dying'" class="slain-stamp" role="status">
          <strong class="slain-word">Slain</strong>
          <span class="slain-name">{{ PERSONALITY_NAME[boss.personality] }}</span>
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

    <Teleport to="body">
      <BossBar
        ref="bar"
        :sprite="PERSONALITY_SPRITE[boss.personality]"
        :name="PERSONALITY_NAME[boss.personality]"
        :current="boss.health"
        :max="boss.maxHealth"
        :hero-class="heroClassFor(hero)"
        :hero-current="hero.currentHealth"
        :hero-max="effectiveStat(hero, 'health')"
        :hero-level="heroLevel"
        :shown="scrolledPast"
        :phase="phase"
      />
    </Teleport>

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

/* The name tops out 62px above the stage's bottom edge, on its fog band;
   0.6rem is .summary-row's gap. */
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
   main.scss). */
.stage-wrap {
  position: relative;
  width: calc(100% + 2rem);
  margin: -1rem -1rem 0;
}

/* The fog band the name and HP bar sit on. */
.stage-wrap::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: auto 0 0;
  height: 45%;
  pointer-events: none;
  background: linear-gradient(0deg, var(--stage-fog, var(--code-bg)) 18%, transparent);
}

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
   dark rim and a glow, in the boss's damage colour. */
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

/* Above the name and HP bar. */
.hit-layer {
  position: absolute;
  z-index: 3;
  inset: 0;
  pointer-events: none;
}

/* Big, outlined and held before it fades, so it reads over the sprite's busy
   pixels. Centered on the stage. */
.damage-popup {
  position: absolute;
  top: 35%;
  left: 50%;
  translate: -50% 0;
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

/* ---------- A kill: flash, fall into the fog, "Slain" ---------- */

.sprite-wrapper.dying :deep(.sprite) {
  transform-origin: 50% 100%;
  animation: boss-fall 1.1s cubic-bezier(0.5, 0, 0.8, 0.4) both;
}

.sprite-wrapper.arriving :deep(.sprite) {
  animation: boss-arrive 0.8s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

.death-flash {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(ellipse 50% 60% at 50% 60%, rgba(255, 240, 210, 0.85), transparent 70%);
  animation: death-flash 0.45s ease-out;
}

.death-sparks {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  --spark: var(--accent);
  background-image:
    radial-gradient(2px 2px at 40% 80%, var(--spark) 50%, transparent 55%),
    radial-gradient(1.5px 1.5px at 52% 70%, var(--spark) 50%, transparent 55%),
    radial-gradient(2px 2px at 60% 85%, var(--spark) 50%, transparent 55%),
    radial-gradient(1.5px 1.5px at 46% 60%, var(--spark) 50%, transparent 55%),
    radial-gradient(1.8px 1.8px at 56% 55%, var(--spark) 50%, transparent 55%),
    radial-gradient(1.2px 1.2px at 35% 66%, var(--spark) 50%, transparent 55%),
    radial-gradient(1.6px 1.6px at 65% 62%, var(--spark) 50%, transparent 55%);
  animation: death-sparks 1.6s ease-out 0.2s;
}

/* Over the stage, clear of the name and HP bar on its fog band. */
.slain-stamp {
  position: absolute;
  z-index: 4;
  inset: 0 0 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  pointer-events: none;
  animation: slain-stamp 1.9s ease 0.35s both;
}

.slain-stamp::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 8%;
  right: 8%;
  height: 4.5rem;
  transform: translateY(-50%);
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.75) 20%, rgba(0, 0, 0, 0.75) 80%, transparent);
}

.slain-word {
  color: var(--text-h);
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-shadow:
    0 0 14px var(--accent),
    0 2px 0 #000;
}

.slain-name {
  color: var(--text);
  font-size: 0.9rem;
  text-shadow: 0 1px 6px #000;
}

/* Staggers, then sinks into the fog. */
@keyframes boss-fall {
  0% {
    transform: none;
    opacity: 1;
  }
  18% {
    transform: translateX(-4px) rotate(-3deg);
  }
  30% {
    transform: translateX(3px) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: translateY(46px) scaleY(0.7);
    opacity: 0;
  }
}

@keyframes boss-arrive {
  0% {
    opacity: 0;
    transform: translateY(24px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes death-flash {
  25% {
    opacity: 1;
  }
}

@keyframes death-sparks {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-90px);
  }
}

@keyframes slain-stamp {
  0% {
    opacity: 0;
    transform: scale(1.25);
  }
  15% {
    opacity: 1;
    transform: none;
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sprite-wrapper.dying :deep(.sprite) {
    animation: none;
    opacity: 0;
  }

  .sprite-wrapper.arriving :deep(.sprite),
  .death-flash,
  .death-sparks,
  .slain-stamp {
    animation: none;
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
    transform: translateY(-36px) scale(1);
  }
}
</style>
