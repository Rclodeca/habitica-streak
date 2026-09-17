<script setup lang="ts">
import { computed } from 'vue';
import type { Personality } from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useBossStore } from '../../store/bossStore';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';

// Boss art from HabitRPG/habitica-images (CC-BY-NC-SA 3.0, see CREDITS.md),
// picked to match each personality's emphasized stat in game-engine/boss.ts.
const PERSONALITY_SPRITE: Record<Personality, string> = {
  balanced: 'bosses/balanced',
  tank: 'bosses/tank',
  armored: 'bosses/armored',
  warded: 'bosses/warded',
  brute: 'bosses/brute',
};

const bossStore = useBossStore();

const boss = computed(() => bossStore.boss);

const { popups, isHit } = useDamagePopup(() => bossStore.boss.health);
</script>

<template>
  <section class="panel boss-panel">
    <div class="panel-header">
      <div class="sprite-wrapper" :class="{ hit: isHit }">
        <Sprite :image-name="PERSONALITY_SPRITE[boss.personality]" alt="Boss" />
        <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      </div>
      <h2>Boss #{{ boss.index }} — {{ boss.personality }}</h2>
    </div>
    <HealthBar :current="boss.health" :max="boss.maxHealth" variant="boss" />

    <dl class="stat-list">
      <dt>Physical attack</dt>
      <dd>{{ boss.physicalAttack.toFixed(1) }}</dd>

      <dt>Magic attack</dt>
      <dd>{{ boss.magicAttack.toFixed(1) }}</dd>

      <dt>Armor</dt>
      <dd>{{ boss.armor.toFixed(1) }}</dd>

      <dt>Magic resist</dt>
      <dd>{{ boss.magicResist.toFixed(1) }}</dd>
    </dl>
  </section>
</template>

<style scoped>
.boss-panel {
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

.stat-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1rem;
  margin: 0;
}

.stat-list dt {
  font-weight: 600;
  color: var(--text-h);
}

.stat-list dd {
  margin: 0;
  text-align: right;
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
