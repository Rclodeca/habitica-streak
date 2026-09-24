<script setup lang="ts">
import { computed, ref } from 'vue';
import { describeItemBonus, effectiveCritChance, effectiveStat, expToNextLevel, ITEM_CATALOG } from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useCharacterStore } from '../../store/characterStore';
import ExpBar from '../ui/ExpBar.vue';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import PlayerSprite from './PlayerSprite.vue';

// Full stat/item detail lives in a modal so the always-visible panel stays
// small (sprite + level + HP bar) — see BossPanel.vue for the same pattern.
const showDetails = ref(false);

const characterStore = useCharacterStore();

const baseUrl = import.meta.env.BASE_URL;

const character = computed(() => characterStore.character);
const maxHealth = computed(() => effectiveStat(character.value, 'health'));
const expNeeded = computed(() => expToNextLevel(character.value.level));
const physicalDamage = computed(() => effectiveStat(character.value, 'physicalDamage'));
const magicDamage = computed(() => effectiveStat(character.value, 'magicDamage'));
const healing = computed(() => effectiveStat(character.value, 'healing'));
const critChance = computed(() => effectiveCritChance(character.value));

// Fixed 4 slots, in whatever order they were equipped — empty ones render
// as blank grid cells rather than being compacted away, so the grid never
// visually shifts as items are gained/replaced.
const equippedSlots = computed(() =>
  Array.from({ length: 4 }, (_, i) => {
    const itemId = character.value.equippedItemIds[i];
    return itemId ? ITEM_CATALOG.find((item) => item.id === itemId) ?? null : null;
  }),
);

// Which slot's stats callout is pinned open by a tap/click (persists until
// tapped again or another slot is tapped) — separate from the CSS-only
// :hover reveal, which only fires for mouse users.
const pinnedSlot = ref<number | null>(null);
function togglePin(i: number) {
  pinnedSlot.value = pinnedSlot.value === i ? null : i;
}

const { popups, isHit } = useDamagePopup(() => characterStore.character.currentHealth);
</script>

<template>
  <section class="panel character-panel">
    <button type="button" class="summary-row" @click="showDetails = true">
      <div class="sprite-wrapper" :class="{ hit: isHit }">
        <PlayerSprite :character="character" />
        <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      </div>
      <div class="summary-info">
        <h2>Character — Level {{ character.level }}</h2>
        <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
      </div>
    </button>

    <Modal v-model="showDetails" title="Character details">
      <div class="item-grid">
        <div
          v-for="(item, i) in equippedSlots"
          :key="i"
          class="item-slot"
          :class="{ pinned: pinnedSlot === i }"
          @click="item && togglePin(i)"
        >
          <template v-if="item">
            <img class="item-icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
            <div class="item-tooltip">{{ item.name }} — {{ describeItemBonus(item) }}</div>
          </template>
        </div>
      </div>

      <ExpBar :current="character.exp" :max="expNeeded" />

      <dl class="stat-list">
        <dt>Physical damage</dt>
        <dd>{{ physicalDamage.toFixed(1) }}</dd>

        <dt>Magic damage</dt>
        <dd>{{ magicDamage.toFixed(1) }}</dd>

        <dt>Healing</dt>
        <dd>{{ healing.toFixed(1) }}</dd>

        <dt>Crit chance</dt>
        <dd>{{ (critChance * 100).toFixed(1) }}%</dd>
      </dl>
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

.summary-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.summary-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 4px;
  width: 96px;
  height: 96px;
  margin: 0 0 0.75rem;
}

.item-slot {
  position: relative;
  background: var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.item-icon {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
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

/* A center-anchored tooltip on a right-column slot risks clipping off the
   modal's right edge on a narrow phone screen. Anchor those to their own
   right edge instead. */
.item-slot:nth-child(2n) .item-tooltip {
  left: auto;
  right: 0;
  transform: none;
}

.item-slot:hover .item-tooltip,
.item-slot.pinned .item-tooltip {
  opacity: 1;
}

.stat-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.3rem 1rem;
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
