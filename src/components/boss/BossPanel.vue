<script setup lang="ts">
import { computed, ref } from 'vue';
import { bossMissDamage, PERSONALITY_NAME } from '../../game-engine';
import type { Personality } from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useBossStore } from '../../store/bossStore';
import HealthBar from '../ui/HealthBar.vue';
import Modal from '../ui/Modal.vue';
import Sprite from '../ui/Sprite.vue';

// Boss art from HabitRPG/habitica-images (CC-BY-NC-SA 3.0, see CREDITS.md),
// picked to match each personality's emphasized stat and escalate visually
// within its family as PERSONALITY_NAME's flavor names climb in intensity
// (boss.ts) — every one of the 18 personalities now has its own distinct
// sprite, none reused/borrowed.
const PERSONALITY_SPRITE: Record<Personality, string> = {
  balanced: 'bosses/balanced',
  tank: 'bosses/tank',
  armored: 'bosses/armored',
  armored3x: 'bosses/armored3x',
  armored4x: 'bosses/armored4x',
  armored5x: 'bosses/armored5x',
  warded: 'bosses/warded',
  warded3x: 'bosses/warded3x',
  warded4x: 'bosses/warded4x',
  warded5x: 'bosses/warded5x',
  brute: 'bosses/brute',
  brute3x: 'bosses/brute3x',
  brute4x: 'bosses/brute4x',
  brute5x: 'bosses/brute5x',
  arcane: 'bosses/arcane',
  arcane3x: 'bosses/arcane3x',
  arcane4x: 'bosses/arcane4x',
  arcane5x: 'bosses/arcane5x',
};

const bossStore = useBossStore();

const boss = computed(() => bossStore.boss);

const { popups, isHit } = useDamagePopup(() => bossStore.boss.health);

// A condensed, always-visible emoji stat line (effective numbers only) sits
// under the HP bar; the full base-vs-effective breakdown lives in a modal
// behind the same tap. See CharacterPanel.vue for the same pattern.
const showDetails = ref(false);

const physicalAttack = computed(() => bossMissDamage(boss.value.physicalAttack));
const magicAttack = computed(() => bossMissDamage(boss.value.magicAttack));
</script>

<template>
  <section class="panel boss-panel">
    <button type="button" class="summary-row" @click="showDetails = true">
      <div class="sprite-wrapper" :class="{ hit: isHit }">
        <Sprite :image-name="PERSONALITY_SPRITE[boss.personality]" alt="Boss" />
        <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      </div>
      <div class="summary-info">
        <h2>Boss #{{ boss.index }} — {{ PERSONALITY_NAME[boss.personality] }}</h2>
        <HealthBar :current="boss.health" :max="boss.maxHealth" variant="boss" />
        <p class="stat-summary">
          <span>⚔️ {{ physicalAttack.toFixed(1) }}</span>
          <span>🔮 {{ magicAttack.toFixed(1) }}</span>
          <span>🛡️ {{ boss.armor.toFixed(1) }}</span>
          <span>🔰 {{ boss.magicResist.toFixed(1) }}</span>
          <span>💥 {{ (boss.critChance * 100).toFixed(1) }}%</span>
          <span v-if="boss.reflectPct > 0">🪞 {{ (boss.reflectPct * 100).toFixed(0) }}%</span>
          <span v-if="boss.lifestealPct > 0">🩸 {{ (boss.lifestealPct * 100).toFixed(0) }}%</span>
          <span v-if="boss.woundsAbility">🩹 {{ (boss.woundsAbility.hitChance * 100).toFixed(0) }}%</span>
        </p>
      </div>
    </button>

    <Modal v-model="showDetails" title="Boss details">
      <dl class="stat-list">
        <dt></dt>
        <dd class="col-label">Base</dd>
        <dd class="col-label">Effective</dd>

        <dt>⚔️ Physical attack</dt>
        <dd>{{ boss.physicalAttack.toFixed(1) }}</dd>
        <dd>{{ physicalAttack.toFixed(1) }}</dd>

        <dt>🔮 Magic attack</dt>
        <dd>{{ boss.magicAttack.toFixed(1) }}</dd>
        <dd>{{ magicAttack.toFixed(1) }}</dd>

        <dt>🛡️ Armor</dt>
        <dd>{{ boss.armor.toFixed(1) }}</dd>
        <dd>{{ boss.armor.toFixed(1) }}</dd>

        <dt>🔰 Magic resist</dt>
        <dd>{{ boss.magicResist.toFixed(1) }}</dd>
        <dd>{{ boss.magicResist.toFixed(1) }}</dd>

        <dt>💥 Crit chance</dt>
        <dd>{{ (boss.critChance * 100).toFixed(1) }}%</dd>
        <dd>{{ (boss.critChance * 100).toFixed(1) }}%</dd>

        <template v-if="boss.reflectPct > 0">
          <dt>🪞 Reflect</dt>
          <dd>{{ (boss.reflectPct * 100).toFixed(0) }}%</dd>
          <dd>{{ (boss.reflectPct * 100).toFixed(0) }}%</dd>
        </template>

        <template v-if="boss.lifestealPct > 0">
          <dt>🩸 Lifesteal</dt>
          <dd>{{ (boss.lifestealPct * 100).toFixed(0) }}%</dd>
          <dd>{{ (boss.lifestealPct * 100).toFixed(0) }}%</dd>
        </template>

        <template v-if="boss.woundsAbility">
          <dt>🩹 Wounds chance</dt>
          <dd>{{ (boss.woundsAbility.hitChance * 100).toFixed(0) }}%</dd>
          <dd>{{ (boss.woundsAbility.hitChance * 100).toFixed(0) }}%</dd>
        </template>
      </dl>
      <p class="stat-note">
        Physical/magic attack: Base is the boss's raw attack stat; Effective is the damage a missed medium daily
        habit actually deals (Base × miss-damage factor). Easy misses take ~0.67x, hard ~1.33x, and a crit or missed
        weekly doubles it. Other stats have no separate multiplier, so Base and Effective match.
      </p>
      <p v-if="boss.woundsAbility" class="stat-note">
        Wounds: on a successful hit at this chance, reduces your healing to
        {{ (boss.woundsAbility.effectRate * 100).toFixed(0) }}% for {{ boss.woundsAbility.durationDays }} day(s) —
        doesn't stack or refresh while already active.
      </p>
    </Modal>
  </section>
</template>

<style scoped>
.boss-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.summary-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.summary-info h2 {
  margin: 0;
}

.stat-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-h);
}

.stat-list {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
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

.stat-list .col-label {
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text);
}

.stat-note {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  color: var(--text);
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
