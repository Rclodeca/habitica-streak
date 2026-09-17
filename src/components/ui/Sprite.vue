<script setup lang="ts">
// Mirrors Habitica's ui/sprite.vue pattern: given a bare image name, render
// the placeholder art from public/sprites/. Real pixel-art sprites can drop
// in later without any component changes.
defineProps<{ imageName: string; alt?: string }>();
</script>

<template>
  <img class="sprite" :src="`/sprites/${imageName}.png`" :alt="alt ?? imageName" />
</template>

<style scoped>
.sprite {
  display: block;
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
}
</style>
