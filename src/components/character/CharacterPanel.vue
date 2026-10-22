<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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

// Sized to the character's current slot cap (4, or 6 after the item-slots
// event), in whatever order they were equipped — empty ones
// render as blank grid cells rather than being compacted away, so the grid
// never visually shifts as items are gained/replaced.
const slotCount = computed(() => maxEquipSlots(character.value));
const equippedSlots = computed(() =>
  Array.from({ length: slotCount.value }, (_, i) => {
    const itemId = character.value.equippedItemIds[i];
    return itemId ? ITEM_CATALOG.find((item) => item.id === itemId) ?? null : null;
  }),
);
// 2x2 below level 10, 3 wide x 2 tall once the 6th/5th slots unlock.
const gridCols = computed(() => (slotCount.value > 4 ? 3 : 2));

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
  { icon: 'physical' as const, label: 'Physical', value: expectedPhysicalDamage.value, color: '#f87171' },
  { icon: 'magic' as const, label: 'Magic', value: expectedMagicDamage.value, color: '#b98cfb' },
  { icon: 'healing' as const, label: 'Healing', value: expectedHealing.value, color: '#22c55e' },
  { icon: 'true' as const, label: 'True', value: expectedTrueDamage.value, color: '#f9fafb' },
]);

const equippedItems = computed(() => equippedSlots.value.flatMap((item) => (item ? [item] : [])));
const emptySlotCount = computed(() => slotCount.value - equippedItems.value.length);

const { popups, isHit } = useDamagePopup(() => characterStore.character.currentHealth);
</script>

<template>
  <section class="panel character-panel">
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
          :class="{ pinned: pinnedSlot === i, 'right-edge': (i + 1) % gridCols === 0, enchanted: !!item && itemDoubleFactor(character, item.id) > 1 }"
          @click="item && togglePin(i)"
        >
          <template v-if="item">
            <img class="item-icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
            <div class="item-tooltip">{{ item.name }} — <span class="item-stats">{{ describeItemBonus(item, itemDoubleFactor(character, item.id)) }}</span></div>
          </template>
        </div>
      </div>
    </div>

    <button type="button" class="title-button" @click="showDetails = true">
      <h2>Character — Lv. {{ character.level }}</h2>
      <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
      <ExpBar :current="character.exp" :max="expNeeded" />
      <p class="stat-summary">
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

    <Modal v-model="showDetails" title="Character" max-width="520px">
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
              <img :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
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

/* Cells target ~46px squares (so 2 rows match the 96px sprite, see
   Sprite.vue); max-width is set inline from the column count, and the grid
   shrinks below that on narrow panels. */
.item-grid {
  display: grid;
  gap: 4px;
  flex: 1;
  align-self: center;
}

.item-slot {
  position: relative;
  aspect-ratio: 1;
  background: var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.item-slot.enchanted {
  border: 1px solid var(--accent-solid);
}

.item-slot.enchanted .item-stats {
  color: var(--accent-solid);
}

.item-icon {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* The art has transparent padding around the item, so scaling past the
     cell (the slot doesn't clip — the tooltip must overflow it) enlarges
     the visible icon without growing the grid. */
  transform: scale(1.45);
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
  --rarity: #9ca3af;
}

.rarity-uncommon {
  --rarity: #34d399;
}

.rarity-rare {
  --rarity: #60a5fa;
}

.rarity-epic {
  --rarity: #c084fc;
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

.hero-sprite {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: radial-gradient(circle, var(--accent-bg), transparent 70%);
  border-radius: 12px;
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
  gap: 0.75rem;
  padding: 0.5rem 0.7rem;
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

.gear-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, color-mix(in srgb, var(--rarity) 28%, transparent), transparent 70%);
  border-radius: 8px;
}

.gear-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  transform: scale(1.4);
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
  font-size: 0.65rem;
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
  font-size: 0.65rem;
  font-weight: 600;
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
  font-size: 0.7rem;
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
  font-size: 0.7rem;
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
  top: 0;
  left: 50%;
  color: #e5484d;
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  animation: damage-float-fade 0.9s ease-out forwards;
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
