<script setup lang="ts">
import { computed, ref } from 'vue';
import { expToNextLevel, statAtLevel } from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
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

const { popups, isHit } = useDamagePopup(() => characterStore.character.currentHealth);
</script>

<template>
  <section class="panel character-panel" @click="showStatsModal = true">
    <div class="panel-header">
      <div class="sprite-wrapper" :class="{ hit: isHit }">
        <Sprite image-name="player-placeholder" alt="Player" />
        <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      </div>
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

.sprite-wrapper {
  position: relative;
  display: inline-block;
}

.sprite-wrapper.hit :deep(.sprite) {
  animation: sprite-shake 0.3s ease;
}

.damage-popup {
  position: absolute;
  top: 0;
  left: 50%;
  color: #e5484d;
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  animation: damage-float-fade 0.9s ease-out forwards;
}

@keyframes sprite-shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(3px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-4px);
  }
  40%,
  60% {
    transform: translateX(4px);
  }
}

@keyframes damage-float-fade {
  0% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -30px);
  }
}
</style>
