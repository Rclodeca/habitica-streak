<script setup lang="ts">
import { computed } from 'vue';
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import Modal from './Modal.vue';

const { misses, rewards, hasPending, isOverridden, toggleOverride, acknowledge } = useMissedSkillsGate();

// An override flips the detected outcome, so a card's tone/label follows the
// effective outcome rather than the section it sits in.
function strikesBack(outcome: 'penalty' | 'reward', habitId: string): boolean {
  return (outcome === 'penalty') !== isOverridden(habitId);
}

const anyBlow = computed(
  () =>
    misses.value.some((m) => strikesBack('penalty', m.habitId)) ||
    rewards.value.some((r) => strikesBack('reward', r.habitId)),
);
</script>

<template>
  <Modal :model-value="hasPending" :dismissible="false" title="Daily update" max-width="480px">
    <section v-if="misses.length" class="group">
      <h4 class="group-label">Left undone</h4>
      <ul class="list">
        <li
          v-for="miss in misses"
          :key="miss.habitId"
          class="card"
          :class="strikesBack('penalty', miss.habitId) ? 'blow' : 'boon'"
        >
          <div class="main">
            <span class="name">{{ miss.habitName }}</span>
            <span class="meta">
              <span>{{ miss.period }}</span>
            </span>
          </div>
          <div class="side">
            <span class="outcome">{{ strikesBack('penalty', miss.habitId) ? 'Strikes back' : 'Boss bleeds' }}</span>
            <label class="pill" :class="{ on: isOverridden(miss.habitId) }">
              <input type="checkbox" :checked="isOverridden(miss.habitId)" @change="toggleOverride(miss.habitId)" />
              <span>I did this</span>
            </label>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="rewards.length" class="group">
      <h4 class="group-label">Resisted</h4>
      <ul class="list">
        <li
          v-for="reward in rewards"
          :key="reward.habitId"
          class="card"
          :class="strikesBack('reward', reward.habitId) ? 'blow' : 'boon'"
        >
          <div class="main">
            <span class="name">{{ reward.habitName }}</span>
            <span class="meta">
              <span>{{ reward.period }}</span>
            </span>
          </div>
          <div class="side">
            <span class="outcome">{{ strikesBack('reward', reward.habitId) ? 'Strikes back' : 'Boss bleeds' }}</span>
            <label class="pill" :class="{ on: isOverridden(reward.habitId) }">
              <input type="checkbox" :checked="isOverridden(reward.habitId)" @change="toggleOverride(reward.habitId)" />
              <span>I gave in</span>
            </label>
          </div>
        </li>
      </ul>
    </section>

    <button type="button" class="ok-button" :class="{ boon: !anyBlow }" @click="acknowledge">
      {{ anyBlow ? 'Take the blow' : 'Claim' }}
    </button>
  </Modal>
</template>

<style scoped>
.group {
  margin-bottom: 1rem;
}

.group-label {
  margin: 0 0 0.4rem;
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
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

.card.boon {
  --tone: var(--heal-color);
}

.main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.name {
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text);
  font-size: 0.8rem;
  text-transform: capitalize;
}

.side {
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

.pill {
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

.pill.on {
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

.ok-button.boon {
  background: color-mix(in srgb, var(--heal-color) 18%, transparent);
  border-color: color-mix(in srgb, var(--heal-color) 50%, transparent);
}
</style>
