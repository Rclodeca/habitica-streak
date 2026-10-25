<script setup lang="ts">
import { computed, ref } from 'vue';
import { effectiveStat, heroClassFor, PERSONALITY_NAME } from '../../game-engine';
import { useCelebration } from '../../composables/useCelebration';
import { useScrolledPast } from '../../composables/useScrolledPast';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import BossBar from '../boss/BossBar.vue';
import BossPanel from '../boss/BossPanel.vue';
import { PERSONALITY_SPRITE } from '../boss/bossSprites';
import CharacterPanel from '../character/CharacterPanel.vue';

// The fight as one scene: the boss and the hero square off across one stage,
// each half its own panel with its own details.

const bossStore = useBossStore();
const characterStore = useCharacterStore();

// The slain boss stays up while a kill plays out, as on the stage.
const { phase, displayedBoss, heldLevel } = useCelebration();
const boss = computed(() => displayedBoss.value ?? bossStore.boss);

// The stage scrolls away with the page, and BossBar drops in once the whole
// stage has gone, carrying the hero's HP and level too (the level held back
// like the hero panel's until a level-up's beat plays).
const hero = computed(() => characterStore.character);
const heroLevel = computed(() => heldLevel.value ?? hero.value.level);
const stage = ref<HTMLElement | null>(null);
const bar = ref<InstanceType<typeof BossBar> | null>(null);
const scrolledPast = useScrolledPast(stage, () => (bar.value?.$el as HTMLElement | undefined)?.offsetHeight ?? 0);
</script>

<template>
  <section ref="stage" class="fight-stage">
    <div class="stage-bg" aria-hidden="true" />
    <div class="stage-inner">
      <BossPanel />
      <CharacterPanel />
    </div>

    <Teleport to="body">
      <BossBar
        ref="bar"
        :sprite="PERSONALITY_SPRITE[boss.personality]"
        :name="PERSONALITY_NAME[boss.personality]"
        :current="boss.health"
        :max="boss.maxHealth"
        :hero-class="heroClassFor(hero)"
        :hero-current="hero.currentHealth"
        :hero-max="effectiveStat(hero, 'health')"
        :hero-level="heroLevel"
        :shown="scrolledPast"
        :phase="phase"
      />
    </Teleport>
  </section>
</template>
