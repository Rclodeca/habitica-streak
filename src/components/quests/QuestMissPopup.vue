<script setup lang="ts">
import { computed } from 'vue';
import { useModalPriority } from '../../composables/useModalPriority';
import { useQuestMissGate } from '../../composables/useQuestMissGate';
import Modal from '../ui/Modal.vue';

const { misses, isOverridden, toggleOverride, acknowledge } = useQuestMissGate();
// This popup competes with DeathScreen/MissedSkillsPopup/EventChoiceModal
// for the same full-screen Teleport-to-body stacking context — see
// useModalPriority for why a shared arbiter is needed instead of a
// pairwise gate per modal.
const { questMissVisible } = useModalPriority();

const PIPS = { easy: 1, medium: 2, hard: 3 };

const allRedeemed = computed(() => misses.value.length > 0 && misses.value.every((m) => isOverridden(m.questId)));
</script>

<template>
  <Modal :model-value="questMissVisible" :dismissible="false" title="Deadline passed" max-width="480px">
    <p class="intro">The boss strikes for every deed left undone.</p>
    <ul class="missed-list">
      <li
        v-for="miss in misses"
        :key="miss.questId"
        class="miss-card"
        :class="{ redeemed: isOverridden(miss.questId) }"
      >
        <div class="miss-main">
          <span class="miss-name">{{ miss.description }}</span>
          <span class="miss-meta">
            <span class="pips" :title="miss.difficulty">
              <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= PIPS[miss.difficulty] }" />
            </span>
            <span>Due {{ miss.dueDateKey }}</span>
          </span>
        </div>
        <div class="miss-side">
          <span class="outcome">
            <template v-if="isOverridden(miss.questId)">{{ miss.rewardText }}</template>
            <template v-else>Strikes back</template>
          </span>
          <label class="redeem">
            <input type="checkbox" :checked="isOverridden(miss.questId)" @change="toggleOverride(miss.questId)" />
            <span>I did this</span>
          </label>
        </div>
      </li>
    </ul>
    <button type="button" class="ok-button" :class="{ redeemed: allRedeemed }" @click="acknowledge">
      {{ allRedeemed ? 'Claim' : 'Take the blow' }}
    </button>
  </Modal>
</template>

<style scoped>
.intro {
  margin: 0 0 0.75rem;
  padding: 0.6rem 0.8rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--damage-color);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
}

.missed-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.miss-card {
  --tone: var(--damage-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  background: color-mix(in srgb, var(--tone) 8%, var(--code-bg));
  border: 1px solid color-mix(in srgb, var(--tone) 35%, var(--border));
  border-left: 3px solid var(--tone);
  border-radius: 8px;
  box-shadow: 0 0 14px -8px var(--tone);
  transition:
    background 0.2s,
    border-color 0.2s;
}

.miss-card.redeemed {
  --tone: var(--heal-color);
}

.miss-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.miss-name {
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.miss-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text);
  font-size: 0.8rem;
}

.pips {
  display: flex;
  gap: 0.25rem;
}

.pip {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--tone);
}

.miss-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}

.outcome {
  color: var(--tone);
  font-size: 0.85rem;
  font-weight: 600;
}

.redeem {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-h);
  font-size: 0.8rem;
  white-space: nowrap;
  cursor: pointer;
}

.miss-card.redeemed .redeem {
  border-color: var(--tone);
}

.ok-button {
  display: block;
  width: 100%;
  padding: 0.8rem 1.2rem;
  background: color-mix(in srgb, var(--damage-color) 18%, transparent);
  border-color: color-mix(in srgb, var(--damage-color) 50%, transparent);
  color: var(--text-h);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.ok-button.redeemed {
  background: color-mix(in srgb, var(--heal-color) 18%, transparent);
  border-color: color-mix(in srgb, var(--heal-color) 50%, transparent);
}
</style>
