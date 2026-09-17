<script setup lang="ts">
// Composited player sprite: a fixed base (skin + shirt + hair) with up to
// 3 gear layers stacked on top, driven by whichever items are currently
// equipped. All layer PNGs share the same 90x90 canvas/pose (verified
// against the HabitRPG/habitica-images source — see CREDITS.md), so plain
// absolute positioning at inset:0 is enough; no per-layer offset data is
// needed. Stacking order (back to front): skin, shirt, armor (covers the
// shirt when equipped), hair, shield, weapon.

import { computed } from 'vue';
import { bodySpriteFor, ITEM_CATALOG } from '../../game-engine';
import type { Character } from '../../game-engine';

const props = defineProps<{ character: Character }>();

const equippedItems = computed(() =>
  ITEM_CATALOG.filter((item) => props.character.equippedItemIds.includes(item.id)),
);

function firstEquippedWithStat(stat: string) {
  return equippedItems.value.find((item) => item.stat === stat) ?? null;
}

// Physical and magic items both render in the weapon slot — if a character
// somehow has both equipped at once, the sword wins; a rare, harmless
// tie-break rather than a real conflict (there's only one hand to draw).
const weaponLayer = computed(
  () => bodySpriteFor(firstEquippedWithStat('physicalDamage')) ?? bodySpriteFor(firstEquippedWithStat('magicDamage')),
);
const armorLayer = computed(() => bodySpriteFor(firstEquippedWithStat('health')));
const shieldLayer = computed(() => bodySpriteFor(firstEquippedWithStat('healing')));
</script>

<template>
  <div class="player-sprite">
    <img class="layer" src="/sprites/player/base-skin.png" alt="Player" />
    <img class="layer" src="/sprites/player/base-shirt.png" alt="" />
    <img v-if="armorLayer" class="layer" :src="`/sprites/${armorLayer}.png`" alt="" />
    <img class="layer" src="/sprites/player/base-hair.png" alt="" />
    <img v-if="shieldLayer" class="layer" :src="`/sprites/${shieldLayer}.png`" alt="" />
    <img v-if="weaponLayer" class="layer" :src="`/sprites/${weaponLayer}.png`" alt="" />
  </div>
</template>

<style scoped>
.player-sprite {
  position: relative;
  width: 96px;
  height: 96px;
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
