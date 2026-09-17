<script setup lang="ts">
import { computed, ref } from 'vue';
import { expToNextLevel, statAtLevel } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import CharacterStatsModal from './CharacterStatsModal.vue';
import ExpBar from '../ui/ExpBar.vue';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';

const characterStore = useCharacterStore();

const character = computed(() => characterStore.character);
const maxHealth = computed(() => statAtLevel(character.value.starterStats.health, character.value.level));
const expNeeded = computed(() => expToNextLevel(character.value.level));

const showStatsModal = ref(false);
</script>

<template>
  <section class="panel character-panel" @click="showStatsModal = true">
    <div class="panel-header">
      <Sprite image-name="player-placeholder" alt="Player" />
      <h2>Character — Level {{ character.level }}</h2>
    </div>
    <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
    <ExpBar :current="character.exp" :max="expNeeded" />
  </section>

  <CharacterStatsModal v-model="showStatsModal" :character="character" />
</template>

<style scoped>
.character-panel {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.panel-header h2 {
  margin: 0;
}
</style>
