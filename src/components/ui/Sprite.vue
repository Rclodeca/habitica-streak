<script setup lang="ts">
// Mirrors Habitica's ui/sprite.vue pattern: given a bare image name (a
// path segment relative to public/sprites/), render the art. New sprites
// can drop in later without any component changes.
defineProps<{ imageName: string; alt?: string }>();
</script>

<template>
  <img class="sprite" :src="`/sprites/${imageName}.png`" :alt="alt ?? imageName" />
</template>

<style scoped>
.sprite {
  display: block;
  width: 96px;
  height: 96px;
}
</style>
