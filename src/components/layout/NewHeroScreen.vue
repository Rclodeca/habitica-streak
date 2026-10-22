<script setup lang="ts">
import { ref } from 'vue';
import { ChevronsUp, Sword, Swords } from 'lucide-vue-next';
import { DEFAULT_HERO_NAME, MAX_HERO_NAME_LENGTH } from '../../game-engine';
import { useFallenHero } from '../../composables/useFallenHero';
import { useCharacterStore } from '../../store/characterStore';
import PlayerSprite from '../character/PlayerSprite.vue';
import RuleList from '../ui/RuleList.vue';
import type { Rule } from '../ui/RuleList.vue';

// Full-screen greeting shown in place of the dashboard while the hero is
// unnamed (see Character.name): the very first launch, and every new run after
// "Start new run". Naming the hero is what dismisses it.
const characterStore = useCharacterStore();
const { fallen, clearFallen } = useFallenHero();

const name = ref('');

const RULES: Rule[] = [
  { icon: Sword, tone: 'accent', title: 'Keep', text: 'A habit kept strikes the boss.' },
  { icon: Swords, tone: 'danger', title: 'Break', text: 'A habit broken, the boss strikes back.' },
  { icon: ChevronsUp, tone: 'solid', title: 'Rise', text: 'Each boss slain makes you stronger.' },
];

function begin() {
  characterStore.setName(name.value);
  clearFallen();
}
</script>

<template>
  <form class="new-hero" @submit.prevent="begin">
    <p class="eyebrow">{{ fallen ? 'The fire still burns.' : 'Every habit is a weapon.' }}</p>
    <h1 class="game-title">Habitica Streak</h1>

    <div class="bonfire">
      <PlayerSprite :character="characterStore.character" />
    </div>

    <div class="oath">
      <h2 class="oath-title">{{ fallen ? 'A new hero rises' : 'A new hero' }}</h2>
      <p v-if="fallen" class="fell">{{ fallen.name }} fell to Boss {{ fallen.bossIndex }}. Your habits remain.</p>

      <label class="field">
        <span class="field-label">Name</span>
        <input v-model="name" class="name-input" type="text" :maxlength="MAX_HERO_NAME_LENGTH" :placeholder="DEFAULT_HERO_NAME" autocomplete="off" />
      </label>

      <RuleList :rules="RULES" />

      <button type="submit" class="begin primary-button">{{ fallen ? 'Rise' : 'Begin' }}</button>
    </div>
  </form>
</template>

<style scoped>
.new-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4vh 0 2rem;
  text-align: center;
}

.eyebrow {
  margin: 0;
  color: var(--text);
  font-size: 0.9rem;
}

.game-title {
  margin: 0.35rem 0 0;
  color: var(--text-h);
  font-size: clamp(1.8rem, 5vw, 2.8rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.02em;
}

.bonfire {
  position: relative;
  isolation: isolate;
  width: 340px;
  max-width: 100%;
  height: 210px;
  margin: 0.75rem 0 0.25rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bonfire::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 12% 18% 0;
  background: radial-gradient(ellipse at 50% 70%, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03) 55%, transparent 72%);
}

.bonfire::after {
  content: '';
  position: absolute;
  z-index: -1;
  left: 32%;
  right: 32%;
  bottom: 12px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(0, 0, 0, 0.6), transparent 70%);
}

.bonfire :deep(.player-sprite) {
  width: 120px;
  height: 120px;
  margin-bottom: 16px;
}

.bonfire :deep(.layer) {
  image-rendering: pixelated;
}

.oath {
  width: 100%;
  max-width: 460px;
  text-align: left;
}

.oath-title {
  margin: 0 0 1rem;
  color: var(--text-h);
  font-size: 1.1rem;
  text-align: center;
}

.fell {
  margin: -0.35rem 0 1rem;
  color: var(--text);
  font-size: 0.9rem;
  font-style: italic;
  text-align: center;
}

.field {
  display: block;
  margin-bottom: 1.25rem;
}

.field-label {
  display: block;
  margin-bottom: 0.4rem;
  color: var(--text);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.name-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-h);
  font-family: inherit;
  font-size: 1.1rem;
}

.name-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 14px -4px var(--accent);
}

.begin {
  display: block;
  width: 100%;
  padding: 0.8rem 1.2rem;
}
</style>
