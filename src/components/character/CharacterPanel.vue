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
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  maxEquipSlots,
  statAtLevel,
} from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import { useHeroStrip } from '../../composables/useCondensingBoss';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import ExpBar from '../ui/ExpBar.vue';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import { BOOST_STAT_ICON } from '../ui/statIcons';
import type { StatIconName } from '../ui/statIcons';
import PlayerSprite from './PlayerSprite.vue';

// A condensed, always-visible emoji stat line (Buffed numbers) sits next to
// the title; the Base/Buffed breakdown plus what a new medium daily would
// deal lives in a modal behind the same tap. See BossPanel.vue for the same
// pattern.
const showDetails = ref(false);

const characterStore = useCharacterStore();
const debugClockStore = useDebugClockStore();
const habitStore = useHabitStore();

const baseUrl = import.meta.env.BASE_URL;

const character = computed(() => characterStore.character);
// Named on NewHeroScreen; only a hero still waiting on that screen is unnamed.
const heroName = computed(() => character.value.name ?? 'Character');
const maxHealth = computed(() => effectiveStat(character.value, 'health'));
const expNeeded = computed(() => expToNextLevel(character.value.level));
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
// in whatever order they were equipped — empty ones render as blank grid
// cells rather than being compacted away, so the grid never visually shifts
// as items are gained/replaced. Slots not yet unlocked aren't shown anywhere.
const slotCount = computed(() => maxEquipSlots(character.value));
const equippedSlots = computed(() =>
  Array.from({ length: slotCount.value }, (_, i) => {
    const itemId = character.value.equippedItemIds[i];
    return itemId ? ITEM_CATALOG.find((item) => item.id === itemId) ?? null : null;
  }),
);
// 2x2 at 4 slots, 3 wide x 2 tall at 6, 4 wide x 2 tall at 8.
const gridCols = computed(() => slotCount.value / 2);

// Which slot's stats callout is pinned open by a tap/click (persists until
// tapped again, another slot is tapped, or any tap lands outside the slots)
// — separate from the CSS-only :hover reveal, which only fires for mouse
// users.
const pinnedSlot = ref<number | null>(null);
function togglePin(i: number) {
  pinnedSlot.value = pinnedSlot.value === i ? null : i;
}
function unpinOnOutsideTap(event: Event) {
  if (!(event.target as Element | null)?.closest('.item-slot')) pinnedSlot.value = null;
}
onMounted(() => document.addEventListener('click', unpinOnOutsideTap));
onBeforeUnmount(() => document.removeEventListener('click', unpinOnOutsideTap));

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

// On phones this panel is the condensed hero strip pinned under the boss bar,
// whose geometry the boss copies (see useCondensingBoss).
const heroStrip = useHeroStrip();
function registerHeroStrip(el: unknown) {
  heroStrip.value = el instanceof HTMLElement ? el : null;
}

// The strip keeps its stat line to one row: whatever wraps past the first is
// hidden (it's all in the details popup), so the pinned header never grows.
const PHONE = '(max-width: 820px)';
const statLine = ref<HTMLElement | null>(null);
let phone: MediaQueryList | null = null;
let statLineObserver: ResizeObserver | null = null;

function clipStatLine() {
  const items = Array.from(statLine.value?.children ?? []) as HTMLElement[];
  for (const item of items) item.style.display = '';
  if (!phone?.matches) return;
  // Measure every item before hiding any, so hiding can't reflow the rest.
  const shown = items.filter((item) => item.getClientRects().length > 0);
  const tops = shown.map((item) => item.getBoundingClientRect().top);
  const firstRowEnd = shown[0]?.getBoundingClientRect().bottom ?? 0;
  shown.forEach((item, i) => {
    if (tops[i] >= firstRowEnd) item.style.display = 'none';
  });
}

onMounted(() => {
  phone = window.matchMedia?.(PHONE) ?? null;
  phone?.addEventListener('change', clipStatLine);
  // Sizes change with the width, the theme and the numbers themselves.
  statLineObserver = new ResizeObserver(() => requestAnimationFrame(clipStatLine));
  if (statLine.value) statLineObserver.observe(statLine.value);
  document.fonts?.ready.then(clipStatLine);
  clipStatLine();
});
onUpdated(clipStatLine);
onBeforeUnmount(() => {
  phone?.removeEventListener('change', clipStatLine);
  statLineObserver?.disconnect();
});
</script>

<template>
  <section :ref="registerHeroStrip" class="panel character-panel">
    <div class="top-row">
      <div class="sprite-wrapper" :class="{ hit: isHit }">
        <PlayerSprite :character="character" />
        <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      </div>
      <div class="item-grid" :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, maxWidth: `${gridCols * 46 + (gridCols - 1) * 4}px` }">
        <div
          v-for="(item, i) in equippedSlots"
          :key="i"
          class="item-slot"
          :class="[
            item ? `rarity-${item.rarity}` : 'empty',
            { pinned: pinnedSlot === i, 'right-edge': (i + 1) % gridCols === 0, enchanted: !!item && itemDoubleFactor(character, item.id) > 1 },
          ]"
          @click="item && togglePin(i)"
        >
          <template v-if="item">
            <span class="item-art">
              <img class="item-icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
            </span>
            <div class="item-tooltip">{{ item.name }} — <span class="item-stats">{{ describeItemBonus(item, itemDoubleFactor(character, item.id)) }}</span></div>
          </template>
        </div>
      </div>
    </div>

    <button type="button" class="title-button" @click="showDetails = true">
      <h2>{{ heroName }} — Lv. {{ character.level }}</h2>
      <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
      <ExpBar :current="character.exp" :max="expNeeded" />
      <p ref="statLine" class="stat-summary">
        <!-- The EXP bar's numbers again, for themes that set them in this line instead. -->
        <span class="exp-numbers" aria-hidden="true">{{ Math.round(character.exp) }} / {{ Math.round(expNeeded) }}</span>
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
    </button>

    <Modal v-model="showDetails" :title="heroName" max-width="520px">
      <div class="hero">
        <div class="hero-sprite">
          <PlayerSprite :character="character" />
        </div>
        <div class="hero-info">
          <span class="hero-level">Level {{ character.level }}</span>
          <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
          <ExpBar :current="character.exp" :max="expNeeded" />
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
  </section>
</template>

<style scoped>
.character-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.character-panel h2 {
  margin: 0;
}

.top-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.title-button {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: center;
  cursor: pointer;
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

.stat-summary .exp-numbers {
  display: none;
}

/* Cells target ~46px squares (so 2 rows match the 96px sprite, see
   Sprite.vue); max-width is set inline from the column count, and the grid
   shrinks below that on narrow panels. */
.item-grid {
  display: grid;
  gap: 4px;
  flex: 1;
  align-self: center;
}

/* The gear list's recessed slot (.gear-icon), scaled down to the cell. */
.item-slot {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--rarity) 55%, transparent);
  border-radius: 4px;
  background: radial-gradient(circle, color-mix(in srgb, var(--rarity) 22%, transparent), rgba(0, 0, 0, 0.55) 72%);
  box-shadow:
    inset 0 0 0 2px rgba(0, 0, 0, 0.55),
    inset 0 0 0 3px color-mix(in srgb, var(--rarity) 22%, transparent),
    0 0 10px -5px var(--rarity);
  cursor: pointer;
}

.item-slot.empty {
  --rarity: transparent;
  border: 1px dashed var(--border);
  cursor: default;
}

.item-slot.enchanted {
  border-color: var(--accent-solid);
}

.item-slot.enchanted .item-stats {
  color: var(--accent-solid);
}

/* Clips the art's transparent padding; the slot itself mustn't clip, its
   tooltip overflows it. */
.item-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  container-type: inline-size;
}

/* 1 screen px per art pixel (half the gear list's 2x), which puts the item at
   34px. Cells too small for that (8 slots in the desktop column) fit it
   instead, at 36 art pixels across the cell. Same rim and glow as the list. */
.item-icon {
  --rim: color-mix(in srgb, var(--rarity) 55%, #000);
  position: absolute;
  left: 50%;
  top: 50%;
  width: 80px;
  height: 80px;
  width: min(80px, 222cqw);
  height: min(80px, 222cqw);
  transform: translate(-50%, -50%);
  image-rendering: pixelated;
  pointer-events: none;
  filter:
    drop-shadow(1px 0 0 var(--rim))
    drop-shadow(-1px 0 0 var(--rim))
    drop-shadow(0 1px 0 var(--rim))
    drop-shadow(0 -1px 0 var(--rim))
    drop-shadow(0 0 3px color-mix(in srgb, var(--rarity) 45%, transparent));
}

.item-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: normal;
  max-width: min(220px, 90vw);
  box-shadow: var(--shadow);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 10;
}

/* Right-column slots sit near the panel's right edge — the grid itself is
   already right-aligned within the panel (see .top-row) — so a
   center-anchored tooltip risks clipping off the right edge of a narrow
   phone screen. Anchor those to their own right edge instead. */
.item-slot.right-edge .item-tooltip {
  left: auto;
  right: 0;
  transform: none;
}

.item-slot.pinned .item-tooltip {
  opacity: 1;
}

/* Gated to real hover devices: on touch screens :hover sticks after a tap,
   which would keep the tooltip open even after tapping elsewhere. */
@media (hover: hover) {
  .item-slot:hover .item-tooltip {
    opacity: 1;
  }
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

.sprite-wrapper {
  position: relative;
  display: inline-block;
}

.sprite-wrapper.hit :deep(.player-sprite) {
  animation: sprite-shake 0.3s ease;
}

.damage-popup {
  position: absolute;
  top: 35%;
  left: 50%;
  color: var(--hp-color);
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  animation: damage-float-fade 0.9s ease-out forwards;
}

/* Phones: a condensed strip (portrait, name, HP, EXP and the stat line)
   pinned under the condensing boss bar; useCondensingBoss sets its sticky
   top. Gear and the stat breakdown live behind the tap, in the details popup. */
@media (max-width: 820px) {
  .character-panel {
    position: sticky;
    z-index: 4;
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: center;
    column-gap: 11px;
  }

  .top-row {
    display: contents;
  }

  .item-grid {
    display: none;
  }

  .stat-summary {
    justify-content: flex-start;
  }

  .character-panel .sprite-wrapper {
    display: grid;
    place-items: end center;
    width: 52px;
    height: 52px;
    border: 1px solid var(--portrait-border);
    border-radius: 8px;
  }

  .sprite-wrapper .player-sprite {
    width: 50px;
    height: 50px;
  }

  .title-button {
    gap: 0.35rem;
    text-align: left;
  }

  .character-panel h2 {
    font-size: 0.95rem;
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
