<script setup lang="ts">
import { computed } from 'vue';
import { expToNextLevel, statAtLevel } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';

const characterStore = useCharacterStore();

const character = computed(() => characterStore.character);
const maxHealth = computed(() => statAtLevel(character.value.starterStats.health, character.value.level));
const expNeeded = computed(() => expToNextLevel(character.value.level));
</script>

<template>
  <section class="panel character-panel">
    <h2>Character — Level {{ character.level }}</h2>
    <p>HP: {{ Math.round(character.currentHealth) }} / {{ Math.round(maxHealth) }}</p>
    <p>EXP: {{ Math.round(character.exp) }} / {{ Math.round(expNeeded) }}</p>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
}
</style>
