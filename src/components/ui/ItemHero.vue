<script setup lang="ts">
import { computed } from 'vue';
import { describeItemBonus, describeItemBonusParts } from '../../game-engine';
import type { ItemDef } from '../../game-engine';
import StatIcon from './StatIcon.vue';
import { BOOST_STAT_ICON } from './statIcons';

const props = withDefaults(defineProps<{ item: ItemDef; factor?: number }>(), { factor: 1 });

const baseUrl = import.meta.env.BASE_URL;
const chips = computed(() => describeItemBonusParts(props.item, props.factor));
const enchanted = computed(() => props.factor > 1);
</script>

<template>
  <div class="hero" :class="`rarity-${item.rarity}`">
    <div class="icon-frame">
      <img class="icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
    </div>
    <span class="rarity">{{ item.rarity }}</span>
    <strong class="name">{{ item.name }}</strong>
    <div v-if="chips.length" class="bonuses">
      <span v-for="chip in chips" :key="`${chip.stat}${chip.text}`" class="bonus" :class="{ enchanted, drawback: chip.text.startsWith('\u2212') }">
        <StatIcon :name="BOOST_STAT_ICON[chip.stat]" />{{ chip.text }} <span class="bonus-label">{{ chip.label }}</span>
      </span>
    </div>
    <p v-else class="consumable">{{ describeItemBonus(item) }}</p>
    <p v-if="item.effectText" class="effect">{{ item.effectText }}</p>
  </div>
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
  width: 150px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, color-mix(in srgb, var(--rarity) 28%, transparent), transparent 70%);
  border-radius: 12px;
}

/* The rim is a dark rarity tone around the silhouette, as on the gear rows. */
.icon {
  --rim: color-mix(in srgb, var(--rarity) 55%, #000);
  /* The file at its own size, 2 CSS px per art pixel: the item is 100px and
     sharp on every screen. Its transparent padding overflows the frame. */
  flex-shrink: 0;
  width: 240px;
  height: 240px;
  image-rendering: pixelated;
  filter:
    drop-shadow(2px 0 0 var(--rim))
    drop-shadow(-2px 0 0 var(--rim))
    drop-shadow(0 2px 0 var(--rim))
    drop-shadow(0 -2px 0 var(--rim))
    drop-shadow(0 0 6px color-mix(in srgb, var(--rarity) 45%, transparent));
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

/* Same as the character modal's gear rows: the stat's icon, a bright amount, then its dim name. */
.bonuses {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.9rem;
}

.bonus {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-h);
  font-size: 0.95rem;
  font-weight: 600;
}

.bonus.enchanted {
  color: var(--accent-solid);
}

.bonus.drawback {
  color: var(--dmg-physical);
}

.bonus-label {
  color: var(--text);
  font-weight: 500;
}

.consumable {
  margin: 0;
  color: var(--text);
  font-size: 0.85rem;
}

.effect {
  margin: 0;
  margin-top: 0.2rem;
  color: var(--rarity);
  font-size: 0.95rem;
  font-style: italic;
}
</style>
