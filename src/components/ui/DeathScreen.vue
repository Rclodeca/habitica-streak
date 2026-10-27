<script setup lang="ts">
import { computed } from 'vue';
import { heroClassFor } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useDeathScreen } from '../../composables/useDeathScreen';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import { useHabitStore } from '../../store/habitStore';
import { rankNumeral } from '../habits/habitDisplay';
import Modal from './Modal.vue';
import StatIcon from './StatIcon.vue';

const { isDead } = useDeathScreen();
const { restart } = useCombatActions();
const bossStore = useBossStore();
const characterStore = useCharacterStore();
const habitStore = useHabitStore();

const baseUrl = import.meta.env.BASE_URL;
const heroClass = computed(() => heroClassFor(characterStore.character));
const heroLabel = computed(() => heroClass.value.charAt(0).toUpperCase() + heroClass.value.slice(1));

// What survives the death: every skill with a rank or a live streak, one
// ember each, strongest first. A skill whose streak just broke stays, cold.
const embers = computed(() =>
  habitStore.habits
    .filter((habit) => (habit.rank ?? 0) > 0 || habit.streakCount > 0)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || b.streakCount - a.streakCount),
);
</script>

<template>
  <Modal :model-value="isDead" :dismissible="false" max-width="360px">
    <div class="death">
      <p class="title">You died</p>
      <div class="fallen">
        <img :src="`${baseUrl}sprites/player/${heroClass}.png`" alt="" />
      </div>

      <h2>Level {{ characterStore.character.level }} {{ heroLabel }}</h2>
      <p class="meta">Fell to Boss {{ bossStore.boss.index }}</p>

      <template v-if="embers.length">
        <p class="kept">Your skills keep their power</p>
        <ul class="embers">
          <li v-for="habit in embers" :key="habit.id" class="ember" :class="{ cold: habit.streakCount === 0 }" :title="habit.name">
            <span class="gem">
              <span class="numeral">{{ rankNumeral(habit.rank ?? 0) }}</span>
            </span>
            <span class="streak">
              <template v-if="habit.streakCount > 0"><StatIcon name="streak" :size="10" />{{ habit.streakCount }}</template>
              <template v-else>—</template>
            </span>
          </li>
        </ul>
      </template>

      <button type="button" class="restart-button" @click="restart">Rise again</button>
    </div>
  </Modal>
</template>

<style scoped>
.death {
  text-align: center;
}

.title {
  margin: 0 0 0.75rem;
  color: var(--damage-color);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  text-transform: uppercase;
}

/* The hero, gone grey and fading into the ground. */
.fallen {
  width: 112px;
  height: 112px;
  margin: 0 auto 0.4rem;
}

.fallen img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: grayscale(1) brightness(0.5);
  -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent 92%);
  mask-image: linear-gradient(180deg, #000 30%, transparent 92%);
}

h2 {
  margin: 0;
  color: var(--text-h);
  font-size: 1.25rem;
}

.meta {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
}

.kept {
  margin: 1.2rem 0 0.7rem;
  color: var(--text-h);
  font-size: 0.8rem;
  font-weight: 700;
}

/* One ember per surviving skill: its rank inside a diamond, its streak below. */
.embers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ember {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  width: 48px;
}

.gem {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
}

.gem::before {
  content: '';
  position: absolute;
  inset: 5px;
  transform: rotate(45deg);
  border: 1.5px solid var(--accent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.numeral {
  position: relative;
  color: var(--text-h);
  font-size: 0.65rem;
  font-weight: 700;
}

.streak {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.streak :deep(.stat-icon) {
  --k: currentColor;
}

.ember.cold .gem::before {
  opacity: 0.55;
}

.ember.cold .streak {
  color: var(--text);
  font-weight: 500;
}

.restart-button {
  display: block;
  width: 100%;
  margin-top: 1.4rem;
  background: var(--text-h);
  border: 0;
  color: #1b1d26;
  font-weight: 700;
}
</style>
