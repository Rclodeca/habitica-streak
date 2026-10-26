<script setup lang="ts">
import { rankNumeral } from './habitDisplay';

// One diamond per rank, on one line. Nothing for an unranked skill.
defineProps<{ rank: number }>();
</script>

<template>
  <span v-if="rank > 0" class="rank-diamonds" role="img" :aria-label="`Rank ${rankNumeral(rank)}`">
    <i v-for="n in rank" :key="n" />
  </span>
</template>

<style scoped>
.rank-diamonds {
  display: inline-flex;
  align-items: center;
  gap: 1.5px;
  flex-shrink: 0;
}

.rank-diamonds i {
  width: 6px;
  height: 6px;
  background: var(--accent);
  transform: rotate(45deg);
}
</style>
