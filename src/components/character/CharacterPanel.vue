<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue';
import {
  activeCritBoost,
  itemDoubleFactor,
  activeHealBoost,
  activeWoundsEffect,
  dailyPeriodKey,
  damageReductionPct,
  daysBetweenDayKeys,
  describeItemBonus,
  describeItemBonusParts,
  effectiveCritChance,
  effectiveStat,
  expectedMediumDailyDamage,
  expToNextLevel,
  heroClassFor,
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  maxEquipSlots,
  statAtLevel,
} from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import { useCelebration } from '../../composables/useCelebration';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { usePress } from '../../composables/usePress';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import ExpBar from '../ui/ExpBar.vue';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import { BOOST_STAT_ICON } from '../ui/statIcons';
import type { StatIconName } from '../ui/statIcons';
import { DRAWN_FACING_LEFT, HERO_PLACEMENT } from './heroArt';
import PlayerSprite from './PlayerSprite.vue';

// A condensed, always-visible emoji stat line (Buffed numbers) sits under
// the bars; the Base/Buffed breakdown, the gear, and what a new medium daily
// would deal live in a modal behind the hero's half of the stage. See
// BossPanel.vue for the same pattern.
const showDetails = ref(false);

const characterStore = useCharacterStore();
const debugClockStore = useDebugClockStore();
const habitStore = useHabitStore();

const baseUrl = import.meta.env.BASE_URL;

const character = computed(() => characterStore.character);
// Named on NewHeroScreen; only a hero still waiting on that screen is unnamed.
const heroName = computed(() => character.value.name ?? 'Character');
const maxHealth = computed(() => effectiveStat(character.value, 'health'));

// Turned to face the boss across the stage, and stood on its platform by the
// art's visual center (see heroArt.ts).
const heroClass = computed(() => heroClassFor(character.value));
const placement = computed(() => {
  const { width, left, bottom } = HERO_PLACEMENT[heroClass.value];
  return { '--hero-w': width, '--hero-x': left, '--hero-y': bottom };
});

// Until a level-up's beat plays (useCelebration — after any kill it came
// from), the panel holds the old level with a full EXP bar, then ticks over.
const { phase, heldLevel } = useCelebration();
const leveling = computed(() => phase.value === 'leveling');
const displayLevel = computed(() => heldLevel.value ?? character.value.level);
const expNeeded = computed(() => expToNextLevel(displayLevel.value));
const displayExp = computed(() => (heldLevel.value === null ? character.value.exp : expNeeded.value));
const physicalDamage = computed(() => effectiveStat(character.value, 'physicalDamage'));
const magicDamage = computed(() => effectiveStat(character.value, 'magicDamage'));
const healing = computed(() => effectiveStat(character.value, 'healing'));
const trueDamage = computed(() => effectiveStat(character.value, 'trueDamage'));
const critChance = computed(() => effectiveCritChance(character.value, currentDayKey.value));

// Item-only stats: no base value exists, they come purely from equipped gear.
// Armor/MR are flat and show their damage reduction against boss attacks;
// pen is capped at TUNING.ARMOR_MAGIC_PEN_CAP_PCT (see effectiveResistAfterPen).
const armor = computed(() => itemFlatBonus(character.value, 'armor'));
const magicResist = computed(() => itemFlatBonus(character.value, 'magicResist'));
const armorReduction = computed(() => damageReductionPct(armor.value) * 100);
const magicResistReduction = computed(() => damageReductionPct(magicResist.value) * 100);
const lifesteal = computed(() => itemBonusPercent(character.value, 'lifesteal'));
const armorPen = computed(() => Math.min(itemBonusPercent(character.value, 'armorPen'), TUNING.ARMOR_MAGIC_PEN_CAP_PCT));
const magicPen = computed(() => Math.min(itemBonusPercent(character.value, 'magicPen'), TUNING.ARMOR_MAGIC_PEN_CAP_PCT));

const currentDayKey = computed(() => dailyPeriodKey(debugClockStore.now()));
const woundsEffect = computed(() => activeWoundsEffect(character.value, currentDayKey.value));
const critBoost = computed(() => activeCritBoost(character.value, currentDayKey.value));
const critBoostDaysLeft = computed(() =>
  critBoost.value ? critBoost.value.durationDays - daysBetweenDayKeys(critBoost.value.appliedDayKey, currentDayKey.value) : 0,
);
const healBoost = computed(() => activeHealBoost(character.value, currentDayKey.value));
const healBoostDaysLeft = computed(() =>
  healBoost.value ? healBoost.value.durationDays - daysBetweenDayKeys(healBoost.value.appliedDayKey, currentDayKey.value) : 0,
);
const woundsDaysLeft = computed(() =>
  woundsEffect.value ? woundsEffect.value.durationDays - daysBetweenDayKeys(woundsEffect.value.appliedDayKey, currentDayKey.value) : 0,
);

// Pre-item-bonus values, shown alongside the buffed (post-item) ones in the
// details modal so the player can see how much their gear is helping.
const baseHealth = computed(() => statAtLevel(character.value.starterStats.health, character.value.level));
const basePhysicalDamage = computed(() => statAtLevel(character.value.starterStats.physicalDamage, character.value.level));
const baseMagicDamage = computed(() => statAtLevel(character.value.starterStats.magicDamage, character.value.level));
const baseHealing = computed(() => statAtLevel(character.value.starterStats.healing, character.value.level));
const baseTrueDamage = computed(() => statAtLevel(character.value.starterStats.trueDamage, character.value.level));
const baseCritChance = computed(() => character.value.critChance);

function gain(buffed: number, base: number, scale = 1) {
  return Math.round((buffed - base) * scale);
}

// What a new medium DAILY habit of each type would deal right now, computed
// against this character's real daily habits of that type only — the daily
// pool and weekly pool are separate (see habitStore.habitsOfType), so a
// weekly habit of the same type never factors into this number.
const expectedPhysicalDamage = computed(() =>
  expectedMediumDailyDamage(character.value, 'physical', habitStore.habitsOfType('physical', 'daily')),
);
const expectedMagicDamage = computed(() =>
  expectedMediumDailyDamage(character.value, 'magic', habitStore.habitsOfType('magic', 'daily')),
);
const expectedHealing = computed(() =>
  expectedMediumDailyDamage(character.value, 'healing', habitStore.habitsOfType('healing', 'daily')),
);
const expectedTrueDamage = computed(() =>
  expectedMediumDailyDamage(character.value, 'trueDamage', habitStore.habitsOfType('trueDamage', 'daily')),
);

// Sized to the character's current slot cap (4, 6 or 8 — see maxEquipSlots),
// in whatever order they were equipped; the details' Equipment list shows
// the empty ones after the gear. Slots not yet unlocked aren't shown anywhere.
const slotCount = computed(() => maxEquipSlots(character.value));
const equippedSlots = computed(() =>
  Array.from({ length: slotCount.value }, (_, i) => {
    const itemId = character.value.equippedItemIds[i];
    return itemId ? ITEM_CATALOG.find((item) => item.id === itemId) ?? null : null;
  }),
);
interface StatTile {
  icon: StatIconName;
  label: string;
  value: string;
  gain?: string;
  note?: string;
}

function tile(icon: StatIconName, label: string, value: number, base?: number): StatTile {
  const gained = base === undefined ? 0 : gain(value, base);
  return { icon, label, value: value.toFixed(0), gain: gained > 0 ? `+${gained}` : undefined };
}

const statTiles = computed<StatTile[]>(() => {
  const crit = gain(critChance.value, baseCritChance.value, 100);
  return [
    tile('health', 'Max health', maxHealth.value, baseHealth.value),
    tile('physical', 'Physical', physicalDamage.value, basePhysicalDamage.value),
    tile('magic', 'Magic', magicDamage.value, baseMagicDamage.value),
    tile('true', 'True', trueDamage.value, baseTrueDamage.value),
    tile('healing', 'Healing', healing.value, baseHealing.value),
    {
      icon: 'crit' as const,
      label: 'Crit chance',
      value: `${(critChance.value * 100).toFixed(0)}%`,
      gain: crit > 0 ? `+${crit}%` : undefined,
    },
    ...(armor.value > 0
      ? [{ icon: 'armor' as const, label: 'Armor', value: armor.value.toFixed(0), note: `${armorReduction.value.toFixed(1)}% less damage` }]
      : []),
    ...(magicResist.value > 0
      ? [{ icon: 'magicResist' as const, label: 'Magic resist', value: magicResist.value.toFixed(0), note: `${magicResistReduction.value.toFixed(1)}% less damage` }]
      : []),
    ...(lifesteal.value > 0 ? [{ icon: 'lifesteal' as const, label: 'Lifesteal', value: `${lifesteal.value.toFixed(0)}%` }] : []),
    ...(armorPen.value > 0 ? [{ icon: 'armorPen' as const, label: 'Armor pen', value: `${armorPen.value.toFixed(0)}%` }] : []),
    ...(magicPen.value > 0 ? [{ icon: 'magicPen' as const, label: 'Magic pen', value: `${magicPen.value.toFixed(0)}%` }] : []),
  ];
});

const activeEffects = computed(() => {
  const effects: { icon: StatIconName; text: string; days: number; tone: 'boon' | 'bane' }[] = [];
  if (critBoost.value) effects.push({ icon: 'critBoost', text: `+${(critBoost.value.bonus * 100).toFixed(0)}% crit`, days: critBoostDaysLeft.value, tone: 'boon' });
  if (healBoost.value) effects.push({ icon: 'healBoost', text: `+${(healBoost.value.bonus * 100).toFixed(0)}% heal`, days: healBoostDaysLeft.value, tone: 'boon' });
  if (woundsEffect.value) effects.push({ icon: 'wounds', text: `Wounded · ${(woundsEffect.value.effectRate * 100).toFixed(0)}% heal`, days: woundsDaysLeft.value, tone: 'bane' });
  return effects;
});

const newHabitTiles = computed(() => [
  { icon: 'physical' as const, label: 'Physical', value: expectedPhysicalDamage.value, color: 'var(--dmg-physical)' },
  { icon: 'magic' as const, label: 'Magic', value: expectedMagicDamage.value, color: 'var(--dmg-magic)' },
  { icon: 'healing' as const, label: 'Healing', value: expectedHealing.value, color: 'var(--dmg-healing)' },
  { icon: 'true' as const, label: 'True', value: expectedTrueDamage.value, color: 'var(--dmg-true)' },
]);

const equippedItems = computed(() => equippedSlots.value.flatMap((item) => (item ? [item] : [])));
const emptySlotCount = computed(() => slotCount.value - equippedItems.value.length);

const { popups, isHit } = useDamagePopup(() => characterStore.character.currentHealth);
const { pressed, pressHandlers } = usePress();

// The stat line keeps to one row at every width: whatever wraps past the
// first is hidden whole (it's all in the details popup), so the hero's block
// never grows into the boss's half of the stage.
const statLine = ref<HTMLElement | null>(null);
let statLineObserver: ResizeObserver | null = null;

function clipStatLine() {
  const items = Array.from(statLine.value?.children ?? []) as HTMLElement[];
  for (const item of items) item.style.display = '';
  // Measure every item before hiding any, so hiding can't reflow the rest.
  const shown = items.filter((item) => item.getClientRects().length > 0);
  const tops = shown.map((item) => item.getBoundingClientRect().top);
  const firstRowEnd = shown[0]?.getBoundingClientRect().bottom ?? 0;
  shown.forEach((item, i) => {
    if (tops[i] >= firstRowEnd) item.style.display = 'none';
  });
}

onMounted(() => {
  // Sizes change with the width, the theme and the numbers themselves.
  statLineObserver = new ResizeObserver(() => requestAnimationFrame(clipStatLine));
  if (statLine.value) statLineObserver.observe(statLine.value);
  document.fonts?.ready.then(clipStatLine);
  clipStatLine();
});
onUpdated(clipStatLine);
onBeforeUnmount(() => {
  statLineObserver?.disconnect();
});
</script>

<template>
  <!-- The hero's half of the fight stage (FightStage), facing the boss's. -->
  <div class="character-panel" :class="{ leveling, pressed }">
    <div class="hero-plat" aria-hidden="true" />
    <div class="hero-figure" :class="{ hit: isHit, mirrored: DRAWN_FACING_LEFT[heroClass] }" :style="placement">
      <PlayerSprite :character="character" />
      <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      <span v-if="leveling" class="level-ring" aria-hidden="true" />
    </div>
    <div class="hero-block">
      <h2 class="name-line">
        <span class="hero-name">{{ heroName }}</span>
        <span class="level-number">{{ displayLevel }}</span>
        <span v-if="leveling" class="level-up-popup" role="status">Level up</span>
      </h2>
      <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
      <span class="hp-numbers">{{ Math.round(character.currentHealth) }} / {{ Math.round(maxHealth) }}</span>
      <!-- Keyed by level so the bar snaps empty on a level-up instead of draining back. -->
      <ExpBar :key="displayLevel" :current="displayExp" :max="expNeeded" />
      <p ref="statLine" class="stat-summary">
        <span><StatIcon name="physical" />{{ physicalDamage.toFixed(0) }}</span>
        <span><StatIcon name="magic" />{{ magicDamage.toFixed(0) }}</span>
        <span><StatIcon name="healing" />{{ healing.toFixed(0) }}</span>
        <span><StatIcon name="true" />{{ trueDamage.toFixed(0) }}</span>
        <span><StatIcon name="crit" />{{ (critChance * 100).toFixed(0) }}%</span>
        <span v-if="armor > 0"><StatIcon name="armor" />{{ armor.toFixed(0) }}</span>
        <span v-if="magicResist > 0"><StatIcon name="magicResist" />{{ magicResist.toFixed(0) }}</span>
        <span v-if="lifesteal > 0"><StatIcon name="lifesteal" />{{ lifesteal.toFixed(0) }}%</span>
        <span v-if="armorPen > 0"><StatIcon name="armorPen" />{{ armorPen.toFixed(0) }}%</span>
        <span v-if="magicPen > 0"><StatIcon name="magicPen" />{{ magicPen.toFixed(0) }}%</span>
        <span v-if="critBoost"><StatIcon name="critBoost" />+{{ (critBoost.bonus * 100).toFixed(0) }}% crit · {{ critBoostDaysLeft }}d</span>
        <span v-if="healBoost"><StatIcon name="healBoost" />+{{ (healBoost.bonus * 100).toFixed(0) }}% heal · {{ healBoostDaysLeft }}d</span>
        <span v-if="woundsEffect"><StatIcon name="wounds" />{{ (woundsEffect.effectRate * 100).toFixed(0) }}% heal · {{ woundsDaysLeft }}d</span>
      </p>
    </div>
    <!-- The whole half is one button, clipped to its side of the stage's step. -->
    <button type="button" class="tap tap-hero" :aria-label="`${heroName} details`" v-on="pressHandlers" @click="showDetails = true" />

    <Modal v-model="showDetails" :title="heroName" max-width="520px">
      <div class="hero">
        <div class="hero-sprite">
          <PlayerSprite :character="character" />
        </div>
        <div class="hero-info">
          <span class="hero-level">Level {{ displayLevel }}</span>
          <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
          <ExpBar :key="displayLevel" :current="displayExp" :max="expNeeded" />
        </div>
      </div>

      <div v-if="activeEffects.length" class="effects">
        <span v-for="effect in activeEffects" :key="effect.text" class="effect" :class="effect.tone">
          <StatIcon :name="effect.icon" />{{ effect.text }} · {{ effect.days }}d
        </span>
      </div>

      <section class="stat-group">
        <h4 class="group-label">Equipment</h4>
        <ul class="gear-list">
          <li
            v-for="item in equippedItems"
            :key="item.id"
            class="gear-row"
            :class="[`rarity-${item.rarity}`, { enchanted: itemDoubleFactor(character, item.id) > 1 }]"
          >
            <span class="gear-icon">
              <span class="gear-art">
                <img :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
              </span>
            </span>
            <div class="gear-text">
              <span class="gear-name">
                {{ item.name }}
                <span class="gear-rarity">{{ item.rarity }}</span>
                <span v-if="itemDoubleFactor(character, item.id) > 1" class="gear-enchanted">Enchanted</span>
              </span>
              <span v-if="item.type === 'consumable'" class="gear-bonus">{{ describeItemBonus(item) }}</span>
              <span v-else class="gear-bonuses">
                <span v-for="part in describeItemBonusParts(item, itemDoubleFactor(character, item.id))" :key="`${part.stat}${part.text}`" class="gear-bonus">
                  <StatIcon :name="BOOST_STAT_ICON[part.stat]" />{{ part.text }} <span class="gear-bonus-label">{{ part.label }}</span>
                </span>
              </span>
              <span v-if="item.effectText" class="gear-effect">{{ item.effectText }}</span>
            </div>
          </li>
          <li v-for="n in emptySlotCount" :key="`empty-${n}`" class="gear-row empty">Empty slot</li>
        </ul>
      </section>

      <section class="stat-group">
        <h4 class="group-label">Stats</h4>
        <div class="tiles">
          <div v-for="stat in statTiles" :key="stat.label" class="stat-tile">
            <span class="tile-label"><StatIcon :name="stat.icon" badge />{{ stat.label }}</span>
            <span class="tile-value">
              {{ stat.value }}
              <span v-if="stat.gain" class="tile-gain">{{ stat.gain }}</span>
            </span>
            <span v-if="stat.note" class="tile-note">{{ stat.note }}</span>
          </div>
        </div>
      </section>

      <section class="stat-group">
        <h4 class="group-label">A new medium daily would deal</h4>
        <div class="tiles five">
          <div v-for="entry in newHabitTiles" :key="entry.label" class="stat-tile" :style="{ '--tone': entry.color }">
            <span class="tile-label"><StatIcon :name="entry.icon" badge />{{ entry.label }}</span>
            <span class="tile-value tinted">{{ entry.value.toFixed(0) }}</span>
          </div>
        </div>
        <p class="stat-note">Habits of the same type share a pool.</p>
      </section>
    </Modal>
  </div>
</template>

<style scoped>
/* The hero's half of the stage, positioned within FightStage's .stage-inner
   on its phone geometry (--u scales the art on narrow phones). */
.character-panel {
  display: contents;
}

.hero-plat {
  position: absolute;
  left: calc(4 * var(--u));
  bottom: 4px;
  width: calc(152 * var(--u));
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--text) 12%, transparent), transparent 72%);
  transition: background 0.3s ease;
}

/* The whole hero, smaller than the boss and standing on its platform; the
   per-class --hero-* numbers come from HERO_PLACEMENT. No z-index, so its
   hits stack with the blocks. */
.hero-figure {
  position: absolute;
  left: calc(var(--hero-x) * var(--u));
  bottom: calc(var(--hero-y) * 1px);
  width: calc(var(--hero-w) * var(--u));
}

.hero-figure :deep(.player-sprite),
.hero-figure :deep(.hero) {
  width: 100%;
  height: auto;
}

.hero-figure :deep(.hero) {
  transition: filter 0.3s ease;
}

/* `scale` composes with the hit shake's transform. */
.hero-figure.mirrored :deep(.hero) {
  scale: -1 1;
}

.hero-figure.hit :deep(.player-sprite) {
  animation: sprite-shake 0.3s ease;
}

/* Floats on the stage to the hero's right; its left edge keeps clear of the
   hero's art as that shrinks (176px at 390). */
.hero-block {
  position: absolute;
  z-index: 4;
  bottom: 14px;
  right: 16px;
  width: calc(192 * var(--u) - 16px);
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-shadow:
    0 0 8px #000,
    0 1px 2px #000;
}

/* A long name is cut with "…"; the level always shows. */
.name-line {
  position: relative;
  display: flex;
  align-items: baseline;
  min-width: 0;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-h);
  transition: color 0.3s ease;
}

/* The tap cue: a small chevron after the level. */
.name-line::after {
  content: '';
  flex-shrink: 0;
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 9px;
  vertical-align: 1px;
  border-top: 1.5px solid currentColor;
  border-right: 1.5px solid currentColor;
  transform: rotate(45deg);
  color: var(--text);
}

.hero-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hero-block :deep(.health-bar) {
  height: 6px;
}

.hero-block :deep(.exp-bar) {
  height: 4px;
}

.hero-block :deep(.health-bar-label),
.hero-block :deep(.exp-bar-label) {
  display: none;
}

.hp-numbers {
  align-self: flex-end;
  font-size: 0.7rem;
  line-height: 1;
  color: var(--text);
}

.stat-summary span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

/* The banner's hero sits 7% in from the left, each class offset from the
   warrior's spot as on phone. */
@media (min-width: 821px) {
  .hero-plat {
    left: calc(7% - 19px);
    width: 152px;
  }

  .hero-figure {
    left: calc(7% + (var(--hero-x) - 23) * 1px);
  }

  .hero-block {
    bottom: 18px;
    right: auto;
    left: calc(7% + 200px);
    width: 250px;
  }
}

/* One row only: clipStatLine hides whichever chips wrap past it. */
.stat-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-h);
}

/* A transparent button over the whole stage, clipped to the hero's side of
   the step (BossPanel's .tap-boss is the rest). */
.tap {
  position: absolute;
  inset: 0;
  z-index: 6;
  margin: 0;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tap:focus-visible {
  outline: none;
}

/* Held (or focused from the keyboard): the hero brightens, its platform and
   name light up. On at once, so even a quick tap shows it, then fades. */
.pressed .hero-figure :deep(.hero),
.character-panel:has(.tap:focus-visible) .hero-figure :deep(.hero) {
  filter: brightness(1.25);
}

.pressed .hero-plat,
.character-panel:has(.tap:focus-visible) .hero-plat {
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 30%, transparent), transparent 72%);
}

.pressed .name-line,
.character-panel:has(.tap:focus-visible) .name-line {
  color: var(--accent);
}

.pressed .hero-plat,
.pressed .name-line,
.pressed .hero-figure :deep(.hero) {
  transition-duration: 0s;
}

.tap-hero {
  clip-path: polygon(
    0 var(--split-yl),
    var(--split-x) var(--split-yl),
    var(--split-x) var(--split-yr),
    100% var(--split-yr),
    100% 100%,
    0 100%
  );
}

.rarity-common {
  --rarity: var(--rarity-common);
}

.rarity-uncommon {
  --rarity: var(--rarity-uncommon);
}

.rarity-rare {
  --rarity: var(--rarity-rare);
}

.rarity-epic {
  --rarity: var(--rarity-epic);
}

.rarity-relic {
  --rarity: var(--side-quest-color);
}

.hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--code-bg);
  border: 1px solid var(--accent-border);
  border-radius: 12px;
  box-shadow: 0 0 18px -8px var(--accent);
}

/* The hero at its file size, which is 2 screen px per art pixel, the gear
   icons' scale. Every hero is 142px wide at that size; the transparent canvas
   around it overflows this box. The rim and glow match the gear icons'. */
.hero-sprite {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  width: 142px;
}

/* A tad under that on dense screens, at the nearest size that is still a
   whole number of device pixels per art pixel: 3 on 2x screens, 5 on 3x. */
@media (min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2) {
  .hero-sprite {
    zoom: 0.75;
  }
}

@media (min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3) {
  .hero-sprite {
    zoom: 0.8333;
  }
}

.hero-sprite .player-sprite {
  flex-shrink: 0;
  width: auto;
  height: auto;
}

.hero-sprite :deep(.hero) {
  --rim: color-mix(in srgb, var(--accent) 25%, #000);
  width: auto;
  height: auto;
  filter:
    drop-shadow(2px 0 0 var(--rim))
    drop-shadow(-2px 0 0 var(--rim))
    drop-shadow(0 2px 0 var(--rim))
    drop-shadow(0 -2px 0 var(--rim))
    drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 30%, transparent));
}

.hero-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hero-level {
  color: var(--text-h);
  font-size: 1.2rem;
  font-weight: 600;
}

.gear-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gear-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.6rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--rarity);
  border-radius: 8px;
}

.gear-row.enchanted {
  box-shadow: 0 0 12px -6px var(--accent-solid);
}

.gear-row.empty {
  justify-content: center;
  color: var(--text);
  font-size: 0.8rem;
  border-style: dashed;
  border-left-style: dashed;
  border-left-color: var(--border);
}

/* A recessed slot: rarity hairline, a dark inner bevel and a faint glow. */
.gear-icon {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border: 1px solid color-mix(in srgb, var(--rarity) 55%, transparent);
  border-radius: 4px;
  background: radial-gradient(circle, color-mix(in srgb, var(--rarity) 22%, transparent), rgba(0, 0, 0, 0.55) 72%);
  box-shadow:
    inset 0 0 0 3px rgba(0, 0, 0, 0.55),
    inset 0 0 0 4px color-mix(in srgb, var(--rarity) 22%, transparent),
    0 0 14px -6px var(--rarity);
}

/* Clips the art's transparent padding, which overflows the slot. */
.gear-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
}

/* Each art pixel as an even 2x2 block, so one-pixel lines (staffs, blades)
   don't come out thin and blotchy: the 240px file is 80 art pixels at 3x,
   which puts the item itself at 68px. The rim is a dark rarity tone around
   the silhouette, which thickens thin items. */
.gear-art img {
  --rim: color-mix(in srgb, var(--rarity) 55%, #000);
  position: absolute;
  left: 50%;
  top: 50%;
  width: 160px;
  height: 160px;
  transform: translate(-50%, -50%);
  image-rendering: pixelated;
  pointer-events: none;
  filter:
    drop-shadow(2px 0 0 var(--rim))
    drop-shadow(-2px 0 0 var(--rim))
    drop-shadow(0 2px 0 var(--rim))
    drop-shadow(0 -2px 0 var(--rim))
    drop-shadow(0 0 6px color-mix(in srgb, var(--rarity) 45%, transparent));
}

.gear-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.gear-name {
  color: var(--text-h);
  font-weight: 600;
}

.gear-rarity {
  margin-left: 0.4rem;
  color: var(--rarity);
  font-size: 0.7rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gear-enchanted {
  margin-left: 0.4rem;
  padding: 0 0.4rem;
  background: rgba(167, 139, 250, 0.14);
  border: 1px solid rgba(167, 139, 250, 0.5);
  border-radius: 999px;
  color: var(--accent-solid);
  font-size: 0.7rem;
  font-weight: 600;
}

.gear-effect {
  color: var(--rarity);
  font-size: 0.75rem;
  font-style: italic;
}

.gear-bonuses {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.75rem;
}

.gear-bonus {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--text-h);
  font-size: 0.8rem;
}

.enchanted .gear-bonuses .gear-bonus {
  color: var(--accent-solid);
}

.gear-bonus-label {
  color: var(--text);
}

.effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.effect {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.6rem;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.8rem;
}

.effect.boon {
  color: var(--heal-color);
  background: color-mix(in srgb, var(--heal-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--heal-color) 45%, transparent);
}

.effect.bane {
  color: var(--damage-color);
  background: color-mix(in srgb, var(--damage-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--damage-color) 45%, transparent);
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

.tiles.five {
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
}

.tiles.five .stat-tile {
  padding: 0.55rem 0.5rem;
}

.tiles.five .tile-label {
  font-size: 0.75rem;
  white-space: nowrap;
}

.stat-tile {
  --tone: var(--accent);
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
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  color: var(--text-h);
  font-size: 1.25rem;
  font-weight: 600;
}

.tile-value.tinted {
  color: var(--tone);
}

.tile-gain {
  padding: 0 0.4rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 600;
  text-shadow: 0 0 8px var(--accent);
}

.tile-note {
  color: var(--text);
  font-size: 0.75rem;
}

.stat-note {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  color: var(--text);
}

/* Over the blocks, under the tap areas. */
.damage-popup {
  position: absolute;
  z-index: 5;
  top: 35%;
  left: 50%;
  color: var(--hp-color);
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  animation: damage-float-fade 0.9s ease-out forwards;
}

/* ---------- A level-up: ring, "Level up", the number ticks over ---------- */

.level-ring {
  position: absolute;
  inset: -6px;
  border: 2px solid var(--accent);
  border-radius: 50%;
  box-shadow:
    0 0 20px var(--accent),
    inset 0 0 14px var(--accent);
  pointer-events: none;
  opacity: 0;
  animation: level-ring 1s ease-out;
}

/* At the end of the name line, clear of the portrait. */
.level-up-popup {
  position: absolute;
  top: 50%;
  right: 0;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow:
    0 0 2px #000,
    0 0 10px #000;
  pointer-events: none;
  opacity: 0;
  animation: level-up-float 1.4s ease-out;
}

.level-number {
  display: inline-block;
  flex-shrink: 0;
  margin-left: 0.4em;
}

.leveling .level-number {
  animation: level-tick 0.6s ease;
}

.leveling .exp-bar {
  animation: exp-glow 0.9s ease;
}

@keyframes level-ring {
  0% {
    opacity: 0.9;
    transform: scale(0.6);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@keyframes level-up-float {
  0% {
    opacity: 0;
    transform: translateY(-50%) scale(1.3);
  }
  15%,
  75% {
    opacity: 1;
    transform: translateY(-50%);
  }
  100% {
    opacity: 0;
    transform: translateY(-120%);
  }
}

@keyframes level-tick {
  40% {
    transform: scale(1.6);
    color: var(--accent);
  }
}

@keyframes exp-glow {
  40% {
    box-shadow: 0 0 16px 2px var(--accent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-plat,
  .name-line,
  .hero-figure :deep(.hero) {
    transition: none;
  }

  .level-ring,
  .leveling .level-number,
  .leveling .exp-bar {
    animation: none;
  }

  .level-up-popup {
    animation: none;
    opacity: 1;
    transform: translateY(-50%);
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

@keyframes damage-float-fade {
  0% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -30px);
  }
}
</style>
