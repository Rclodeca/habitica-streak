<script setup lang="ts">
import { computed } from 'vue';
import { describeItemBonus, describeItemBonusParts, ITEM_CATALOG, itemDoubleFactor } from '../../game-engine';
import { useCelebration } from '../../composables/useCelebration';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useCharacterStore } from '../../store/characterStore';
import ItemHero from './ItemHero.vue';
import Modal from './Modal.vue';
import StatIcon from './StatIcon.vue';
import { BOOST_STAT_ICON } from './statIcons';

const { current, droppedBy, dismiss, replace } = useItemDropQueue();
// A kill's drops wait until the boss has fallen on screen.
const { celebrating } = useCelebration();
const characterStore = useCharacterStore();
const baseUrl = import.meta.env.BASE_URL;

const equippedItems = computed(() =>
  ITEM_CATALOG.filter((item) => characterStore.character.equippedItemIds.includes(item.id)),
);

const doubleFactor = (itemId: string) => itemDoubleFactor(characterStore.character, itemId);

// `current` can already be sitting in `equippedItemIds` if it auto-equipped
// into the last open slot (see `useItemDropQueue.processFront` — an
// auto-equipped item stays queued so its informational popup still shows,
// it just isn't shifted out). Branching on this instead of the live `isFull`
// is what keeps the just-picked-up item from appearing in `equippedItems`
// as a candidate to replace itself.
const isCurrentEquipped = computed(
  () => current.value !== null && characterStore.character.equippedItemIds.includes(current.value.id),
);
</script>

<template>
  <Modal
    :model-value="current !== null && !celebrating"
    :dismissible="isCurrentEquipped"
    :scroll-key="current"
    title="Item found!"
    max-width="460px"
    @update:model-value="dismiss"
  >
    <template v-if="current">
      <p v-if="droppedBy" class="dropped-by">Spoils of the <span class="dropped-by-name">{{ droppedBy }}</span></p>
      <ItemHero :item="current" />

      <template v-if="!isCurrentEquipped">
        <p class="replace-label">Replace</p>
        <ul class="replace-list">
          <li
            v-for="item in equippedItems"
            :key="item.id"
            class="gear-row"
            :class="[`rarity-${item.rarity}`, { enchanted: doubleFactor(item.id) > 1 }]"
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
                <span v-if="doubleFactor(item.id) > 1" class="gear-enchanted">Enchanted</span>
              </span>
              <span v-if="item.type === 'consumable'" class="gear-bonus">{{ describeItemBonus(item) }}</span>
              <span v-else class="gear-bonuses">
                <span v-for="part in describeItemBonusParts(item, doubleFactor(item.id))" :key="`${part.stat}${part.text}`" class="gear-bonus">
                  <StatIcon :name="BOOST_STAT_ICON[part.stat]" />{{ part.text }} <span class="gear-bonus-label">{{ part.label }}</span>
                </span>
              </span>
              <span v-if="item.effectText" class="gear-effect">{{ item.effectText }}</span>
            </div>
            <button type="button" class="replace-button" @click="replace(item.id)">Replace</button>
          </li>
        </ul>
      </template>

      <template v-else>
        <p class="equipped-note">✓ Equipped</p>
        <button type="button" class="dismiss-button primary-button" @click="dismiss">Nice!</button>
      </template>
    </template>

    <!-- Pinned below the list, so Drop is in reach without scrolling past every row. -->
    <template v-if="current && !isCurrentEquipped" #footer>
      <button type="button" class="drop-button" @click="dismiss">Drop {{ current.name }}</button>
    </template>
  </Modal>
</template>

<style scoped>
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
  --rarity: var(--rarity-relic);
}

.dropped-by {
  margin: -0.25rem 0 0.75rem;
  color: var(--text);
  font-size: 0.9rem;
  text-align: center;
}

.dropped-by-name {
  color: var(--text-h);
  font-weight: 600;
}

/* "Replace", centred between two hairlines. */
.replace-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.9rem 0 0;
  color: var(--text);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.replace-label::before,
.replace-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.replace-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* The same rows as the character modal's equipment list. */
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
   don't come out thin and blotchy. The rim is a dark rarity tone around the
   silhouette, which thickens thin items. */
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

.replace-button {
  padding: 0.35em 0.9em;
  font-size: 0.85rem;
}

.equipped-note {
  margin: 0.75rem 0 0;
  text-align: center;
  color: var(--heal-color);
  font-size: 0.9rem;
}

.dismiss-button {
  display: block;
  width: 100%;
  margin-top: 0.5rem;
}

.drop-button {
  display: block;
  width: 100%;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-h);
}
</style>
