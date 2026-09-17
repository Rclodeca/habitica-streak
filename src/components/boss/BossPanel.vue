<script setup lang="ts">
import { computed } from 'vue';
import type { Personality } from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useBossStore } from '../../store/bossStore';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';

// Boss art from HabitRPG/habitica-images (CC-BY-NC-SA 3.0, see CREDITS.md),
// picked to match each personality's emphasized stat in game-engine/boss.ts.
// The 3x/4x/5x tiers and the new magic-attack "arcane" family have no
// dedicated art yet, so they reuse their base family's sprite (arcane
// borrows the physical-attacker "brute" sprite as the closest stand-in) —
// differentiated in the UI by the personality label and stats below, not art.
const PERSONALITY_SPRITE: Record<Personality, string> = {
  balanced: 'bosses/balanced',
  tank: 'bosses/tank',
  armored: 'bosses/armored',
  armored3x: 'bosses/armored',
  armored4x: 'bosses/armored',
  armored5x: 'bosses/armored',
  warded: 'bosses/warded',
  warded3x: 'bosses/warded',
  warded4x: 'bosses/warded',
  warded5x: 'bosses/warded',
  brute: 'bosses/brute',
  brute3x: 'bosses/brute',
  brute4x: 'bosses/brute',
  arcane: 'bosses/brute',
  arcane3x: 'bosses/brute',
  arcane4x: 'bosses/brute',
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

      <dt>Crit chance</dt>
      <dd>{{ (boss.critChance * 100).toFixed(1) }}%</dd>

      <template v-if="boss.reflectPct > 0">
        <dt>Reflect</dt>
        <dd>{{ (boss.reflectPct * 100).toFixed(0) }}%</dd>
      </template>

      <template v-if="boss.lifestealPct > 0">
        <dt>Lifesteal</dt>
        <dd>{{ (boss.lifestealPct * 100).toFixed(0) }}%</dd>
      </template>
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
  gap: 0.3rem 1rem;
  margin: 0;
  font-size: 0.8rem;
}

.stat-list dt {
  font-weight: 600;
  color: var(--text-h);
}

.stat-list dd {
  margin: 0;
  text-align: right;
  color: var(--text-h);
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
