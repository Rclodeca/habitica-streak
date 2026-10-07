<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  activeWoundsEffect,
  dailyPeriodKey,
  daysBetweenDayKeys,
  describeItemBonus,
  effectiveCritChance,
  effectiveStat,
  expectedMediumDailyDamage,
  expToNextLevel,
  ITEM_CATALOG,
  maxEquipSlots,
  statAtLevel,
} from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import ExpBar from '../ui/ExpBar.vue';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import PlayerSprite from './PlayerSprite.vue';

// A condensed, always-visible emoji stat line (Effective numbers only — what
// a medium daily of that type deals right now, mirroring the boss's own
// condensed row) sits next to the title; the full Base/Buffed/Effective
// breakdown lives in a modal behind the same tap. See BossPanel.vue for the
// same pattern.
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
const expGain = computed(() => effectiveStat(character.value, 'expGain'));
const critChance = computed(() => effectiveCritChance(character.value));

const currentDayKey = computed(() => dailyPeriodKey(debugClockStore.now()));
const woundsEffect = computed(() => activeWoundsEffect(character.value, currentDayKey.value));
const woundsDaysLeft = computed(() =>
  woundsEffect.value ? woundsEffect.value.durationDays - daysBetweenDayKeys(woundsEffect.value.appliedDayKey, currentDayKey.value) : 0,
);

// Pre-item-bonus values, shown alongside the effective (post-item) ones in
// the details modal so the player can see how much their gear is helping.
const baseHealth = computed(() => statAtLevel(character.value.starterStats.health, character.value.level));
const basePhysicalDamage = computed(() => statAtLevel(character.value.starterStats.physicalDamage, character.value.level));
const baseMagicDamage = computed(() => statAtLevel(character.value.starterStats.magicDamage, character.value.level));
const baseHealing = computed(() => statAtLevel(character.value.starterStats.healing, character.value.level));
const baseTrueDamage = computed(() => statAtLevel(character.value.starterStats.trueDamage, character.value.level));
const baseExpGain = computed(() => statAtLevel(character.value.starterStats.expGain, character.value.level));
const baseCritChance = computed(() => character.value.critChance);

// What a medium DAILY habit of each damage type deals right now — the
// "Effective" column, analogous to a boss's own Effective attack stat (see
// BossPanel.vue), computed against this character's real daily habits of
// that type only — the daily pool and weekly pool are separate (see
// habitStore.habitsOfType), so a weekly habit of the same damage type never
// factors into this number.
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
const expectedExpGain = computed(() =>
  expectedMediumDailyDamage(character.value, 'expGain', habitStore.habitsOfType('expGain', 'daily')),
);

// Sized to the character's current level-dependent slot cap (4 below
// level 10, 6 at 10+), in whatever order they were equipped — empty ones
// render as blank grid cells rather than being compacted away, so the grid
// never visually shifts as items are gained/replaced.
const slotCount = computed(() => maxEquipSlots(character.value.level));
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
          :class="{ pinned: pinnedSlot === i, 'right-edge': (i + 1) % gridCols === 0 }"
          @click="item && togglePin(i)"
        >
          <template v-if="item">
            <img class="item-icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
            <div class="item-tooltip">{{ item.name }} — {{ describeItemBonus(item) }}</div>
          </template>
        </div>
      </div>
    </div>

    <button type="button" class="title-button" @click="showDetails = true">
      <h2>Character — Lv. {{ character.level }}</h2>
      <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
      <ExpBar :current="character.exp" :max="expNeeded" />
      <p class="stat-summary">
        <span>⚔️ {{ expectedPhysicalDamage.toFixed(0) }}</span>
        <span>🔮 {{ expectedMagicDamage.toFixed(0) }}</span>
        <span>💚 {{ expectedHealing.toFixed(0) }}</span>
        <span>⚡ {{ expectedTrueDamage.toFixed(0) }}</span>
        <span>💥 {{ (critChance * 100).toFixed(0) }}%</span>
        <span v-if="woundsEffect">🩹 {{ (woundsEffect.effectRate * 100).toFixed(0) }}% heal · {{ woundsDaysLeft }}d</span>
      </p>
    </button>

    <Modal v-model="showDetails" title="Character details">
      <dl class="stat-list">
        <dt></dt>
        <dd class="col-label">Base</dd>
        <dd class="col-label">Buffed</dd>
        <dd class="col-label">Effective</dd>

        <dt>❤️ Max health</dt>
        <dd>{{ baseHealth.toFixed(0) }}</dd>
        <dd>{{ maxHealth.toFixed(0) }}</dd>
        <dd>{{ maxHealth.toFixed(0) }}</dd>

        <dt>⚔️ Physical damage</dt>
        <dd>{{ basePhysicalDamage.toFixed(0) }}</dd>
        <dd>{{ physicalDamage.toFixed(0) }}</dd>
        <dd>{{ expectedPhysicalDamage.toFixed(0) }}</dd>

        <dt>🔮 Magic damage</dt>
        <dd>{{ baseMagicDamage.toFixed(0) }}</dd>
        <dd>{{ magicDamage.toFixed(0) }}</dd>
        <dd>{{ expectedMagicDamage.toFixed(0) }}</dd>

        <dt>💚 Healing</dt>
        <dd>{{ baseHealing.toFixed(0) }}</dd>
        <dd>{{ healing.toFixed(0) }}</dd>
        <dd>{{ expectedHealing.toFixed(0) }}</dd>

        <dt>⚡ True damage</dt>
        <dd>{{ baseTrueDamage.toFixed(0) }}</dd>
        <dd>{{ trueDamage.toFixed(0) }}</dd>
        <dd>{{ expectedTrueDamage.toFixed(0) }}</dd>

        <dt>✨ EXP gain</dt>
        <dd>{{ baseExpGain.toFixed(0) }}</dd>
        <dd>{{ expGain.toFixed(0) }}</dd>
        <dd>{{ expectedExpGain.toFixed(0) }}</dd>

        <dt>💥 Crit chance</dt>
        <dd>{{ (baseCritChance * 100).toFixed(0) }}%</dd>
        <dd>{{ (critChance * 100).toFixed(0) }}%</dd>
        <dd>{{ (critChance * 100).toFixed(0) }}%</dd>

        <template v-if="woundsEffect">
          <dt>🩹 Wounded</dt>
          <dd>{{ (woundsEffect.effectRate * 100).toFixed(0) }}% healing</dd>
          <dd>{{ woundsDaysLeft }} day(s) left</dd>
          <dd></dd>
        </template>
      </dl>
      <p class="stat-note">
        Effective: what a brand-new medium daily habit of that type would deal right now, given your current habits
        already sharing that pool — no crit, streak, or Special/Ult bonus. Adding more habits of the same type
        dilutes this number.
      </p>
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
  text-align: left;
  cursor: pointer;
}

.stat-summary {
  display: flex;
  flex-wrap: wrap;
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

.stat-list {
  display: grid;
  grid-template-columns: auto 1fr 1fr 1fr;
  gap: 0.3rem 0.75rem;
  margin: 0;
  font-size: 0.8rem;
}

.stat-list dt {
  font-weight: 600;
  color: var(--text-h);
}

.stat-list dd {
  margin: 0;
  text-align: right;
  color: var(--text-h);
}

.stat-list .col-label {
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text);
}

.stat-note {
  margin: 0.75rem 0 0;
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
