<script setup lang="ts">
import { STAT_ICONS } from './statIcons';
import type { StatIconName } from './statIcons';

const props = withDefaults(defineProps<{ name: StatIconName; badge?: boolean; size?: number }>(), {
  badge: false,
  size: 14,
});
</script>

<template>
  <span class="stat-icon" :class="{ badge }" :style="{ '--k': STAT_ICONS[props.name].color }" aria-hidden="true">
    <component :is="STAT_ICONS[props.name].icon" :size="badge ? 13 : size" :stroke-width="2" />
  </span>
</template>

<style scoped>
.stat-icon {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--k);
  vertical-align: middle;
}

.stat-icon.badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--k) 18%, transparent);
}
</style>
