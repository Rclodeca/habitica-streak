<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Component } from 'vue';
import { ChevronLeft, ChevronRight, ChevronsUp, Dices, Sword, Swords, WandSparkles, Zap } from 'lucide-vue-next';
import { DEFAULT_HERO_NAME, HERO_CLASSES, heroClassFor, MAX_HERO_NAME_LENGTH } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import type { HeroPick } from '../../composables/useCombatActions';
import { useFallenHero } from '../../composables/useFallenHero';
import { useCharacterStore } from '../../store/characterStore';
import { HERO_PICK_PLACEMENT } from '../character/heroArt';
import PlayerSprite from '../character/PlayerSprite.vue';
import RuleList from '../ui/RuleList.vue';
import type { Rule } from '../ui/RuleList.vue';

// Full-screen greeting shown in place of the dashboard while the hero is
// unnamed (see Character.name): the very first launch, and every new run after
// "Start new run". Naming the hero is what dismisses it. A new run also picks
// its hero here, turning through them by the fire; a run already under way
// (an old save named late) just gets its name.
const characterStore = useCharacterStore();
const { fallen } = useFallenHero();
const { beginRun } = useCombatActions();

const baseUrl = import.meta.env.BASE_URL;
const name = ref('');

const PICKS: HeroPick[] = [...HERO_CLASSES, 'fate'];
// The cleric art reads as a mage, so that's its name here.
const PICK_LOOK: Record<HeroPick, { name: string; icon: Component }> = {
  warrior: { name: 'Warrior', icon: Sword },
  cleric: { name: 'Mage', icon: WandSparkles },
  ranger: { name: 'Ranger', icon: Zap },
  fate: { name: 'Fate', icon: Dices },
};
// A horizontal drag at least this long turns the wheel.
const SWIPE_PX = 40;

const choosing = computed(() => characterStore.character.heroPending === true);
// Opens on the hero the run was rolled as: a warrior on the first run, the
// fallen hero after a death.
const pick = ref<HeroPick>(heroClassFor(characterStore.character));
// Fate shows the warrior's shape, darkened.
const shownClass = computed(() => (pick.value === 'fate' ? 'warrior' : pick.value));
const placement = computed(() => {
  const { width, left, bottom } = HERO_PICK_PLACEMENT[shownClass.value];
  return { width: `${width}px`, height: `${width}px`, left: `${left}px`, bottom: `${bottom}px` };
});

function turn(step: number) {
  pick.value = PICKS[(PICKS.indexOf(pick.value) + step + PICKS.length) % PICKS.length];
}

let swipeFromX: number | null = null;

function startSwipe(event: PointerEvent) {
  swipeFromX = event.clientX;
}

function cancelSwipe() {
  swipeFromX = null;
}

function endSwipe(event: PointerEvent) {
  if (swipeFromX === null) return;
  const dx = event.clientX - swipeFromX;
  swipeFromX = null;
  if (Math.abs(dx) >= SWIPE_PX) turn(dx < 0 ? 1 : -1);
}

const RULES: Rule[] = [
  { icon: Sword, tone: 'accent', title: 'Keep', text: 'A habit kept strikes the boss.' },
  { icon: Swords, tone: 'danger', title: 'Break', text: 'A habit broken, the boss strikes back.' },
  { icon: ChevronsUp, tone: 'solid', title: 'Rise', text: 'Each boss slain makes you stronger.' },
];

function begin() {
  beginRun(name.value, pick.value);
}
</script>

<template>
  <form class="new-hero" @submit.prevent="begin">
    <p class="eyebrow">{{ fallen ? 'The fire still burns.' : 'Every habit is a weapon.' }}</p>
    <h1 class="game-title">Habitica Streak</h1>

    <template v-if="choosing">
      <div class="hero-pick" @pointerdown="startSwipe" @pointerup="endSwipe" @pointercancel="cancelSwipe">
        <button type="button" class="turn turn-prev" aria-label="Previous hero" @click="turn(-1)">
          <ChevronLeft :size="26" :stroke-width="1.4" />
        </button>
        <div class="bonfire">
          <div class="pick-hero" :class="{ fated: pick === 'fate' }">
            <img :src="`${baseUrl}sprites/player/${shownClass}.png`" :style="placement" alt="" draggable="false" />
            <span v-if="pick === 'fate'" class="fate-mark">?</span>
          </div>
        </div>
        <button type="button" class="turn turn-next" aria-label="Next hero" @click="turn(1)">
          <ChevronRight :size="26" :stroke-width="1.4" />
        </button>
      </div>
      <p class="pick-name" :class="`pick-${pick}`" aria-live="polite">
        <component :is="PICK_LOOK[pick].icon" class="pick-icon" :size="15" />{{ PICK_LOOK[pick].name }}
      </p>
      <div class="pick-dots" aria-hidden="true">
        <i v-for="p in PICKS" :key="p" :class="{ on: p === pick }" />
      </div>
    </template>
    <div v-else class="bonfire">
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
  /* Full width up to 340px: a fixed 340px forced the page wider than a 320px phone. */
  width: 100%;
  max-width: 340px;
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
  /* Fades out inside its box, so the glow has no hard bottom edge. */
  background: radial-gradient(closest-side at 50% 62%, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03) 70%, transparent);
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

.hero-pick {
  position: relative;
  width: 100%;
  max-width: 460px;
  display: flex;
  justify-content: center;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.hero-pick .bonfire {
  margin-bottom: 0;
}

.turn {
  position: absolute;
  top: 50%;
  z-index: 1;
  width: 48px;
  height: 48px;
  margin-top: -24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.turn-prev {
  left: 0;
}

.turn-next {
  right: 0;
}

.pick-hero {
  position: relative;
  width: 150px;
  height: 150px;
  margin-bottom: 8px;
}

.pick-hero img {
  position: absolute;
  image-rendering: pixelated;
  pointer-events: none;
}

.pick-hero.fated img {
  filter: brightness(0) drop-shadow(0 0 10px rgba(224, 120, 58, 0.35));
  opacity: 0.85;
}

.fate-mark {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding-bottom: 20px;
  color: var(--accent);
  font-size: 2.75rem;
}

.pick-name {
  margin: 0.4rem 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-h);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.pick-warrior .pick-icon {
  color: var(--dmg-physical);
}

.pick-cleric .pick-icon {
  color: var(--dmg-magic);
}

.pick-ranger .pick-icon {
  color: var(--dmg-true);
}

.pick-fate .pick-icon {
  color: var(--accent);
}

.pick-dots {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 0.5rem 0 1rem;
}

.pick-dots i {
  width: 6px;
  height: 6px;
  border: 1px solid var(--border);
  border-radius: 50%;
}

.pick-dots i.on {
  background: var(--accent);
  border-color: var(--accent);
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
