<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { describeItemBonus, describeItemBonusParts } from '../../game-engine';
import type { ItemDef } from '../../game-engine';
import StatIcon from './StatIcon.vue';
import { BOOST_STAT_ICON } from './statIcons';

const props = withDefaults(defineProps<{ item: ItemDef; factor?: number }>(), { factor: 1 });

const baseUrl = import.meta.env.BASE_URL;
const chips = computed(() => describeItemBonusParts(props.item, props.factor));
const enchanted = computed(() => props.factor > 1);

// Tapping a stat pill toggles its label (hover covers desktop; touch has
// no hover). Reset whenever a different item is shown.
const openChip = ref<number | null>(null);
watch(
  () => props.item,
  () => {
    openChip.value = null;
  },
);
function toggleChip(index: number) {
  openChip.value = openChip.value === index ? null : index;
}
</script>

<template>
  <div class="hero" :class="`rarity-${item.rarity}`">
    <div class="icon-frame">
      <img class="icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
    </div>
    <span class="rarity">{{ item.rarity }}</span>
    <strong class="name">{{ item.name }}</strong>
    <div v-if="chips.length" class="chips">
      <button
        v-for="(chip, i) in chips"
        :key="`${chip.stat}${chip.text}`"
        type="button"
        class="chip"
        :class="{ open: openChip === i, enchanted }"
        :aria-label="`${chip.text}: ${chip.label}`"
        @click="toggleChip(i)"
      >
        <StatIcon :name="BOOST_STAT_ICON[chip.stat]" />{{ chip.text }}
        <span class="chip-tip" role="tooltip">{{ chip.label }}</span>
      </button>
    </div>
    <p v-else class="consumable">{{ describeItemBonus(item) }}</p>
  </div>
</template>

<style scoped>
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
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.25rem 1rem;
  background: var(--code-bg);
  border: 1px solid var(--rarity);
  border-radius: 12px;
  box-shadow: 0 0 18px -6px var(--rarity);
  text-align: center;
}

.icon-frame {
  width: 112px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, color-mix(in srgb, var(--rarity) 28%, transparent), transparent 70%);
  border-radius: 12px;
}

.icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  /* The art has transparent padding, so scale it up to fill the frame. */
  transform: scale(1.5);
}

.rarity {
  color: var(--rarity);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.name {
  color: var(--text-h);
  font-size: 1.15rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
}

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.6rem;
  background: color-mix(in srgb, var(--rarity) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--rarity) 45%, transparent);
  border-radius: 999px;
  color: var(--text-h);
  font-size: 0.85rem;
  cursor: help;
}

.chip.enchanted {
  background: rgba(167, 139, 250, 0.14);
  border-color: rgba(167, 139, 250, 0.5);
  color: var(--accent-solid);
}

.chip-tip {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  width: max-content;
  max-width: 220px;
  padding: 0.35rem 0.6rem;
  background: var(--bg);
  border: 1px solid var(--rarity);
  border-radius: 6px;
  box-shadow: var(--shadow);
  color: var(--text-h);
  font-size: 0.8rem;
  font-weight: 400;
  line-height: 1.3;
  white-space: normal;
  pointer-events: none;
}

.chip:hover .chip-tip,
.chip:focus-visible .chip-tip,
.chip.open .chip-tip {
  display: block;
}

.consumable {
  margin: 0;
  color: var(--text);
  font-size: 0.85rem;
}
</style>
