<script setup lang="ts">
import { useActivityLogStore } from '../../store/activityLogStore';

const activityLogStore = useActivityLogStore();
</script>

<template>
  <section class="panel activity-log">
    <h2>Log</h2>
    <ul v-if="activityLogStore.entries.length">
      <li v-for="entry in activityLogStore.entries" :key="entry.id">
        <template v-if="entry.kind === 'skill-damage'">
          {{ entry.isTrueDamage ? '⚡' : '⚔️' }} Used "{{ entry.habitName }}" — dealt
          <span :class="entry.isTrueDamage ? 'log-true-damage' : 'log-damage'">{{ Math.round(entry.amount) }}</span>
          damage
        </template>
        <template v-else-if="entry.kind === 'heal'">
          💚 Healed <span class="log-heal">+{{ Math.round(entry.amount) }}</span> HP using "{{ entry.habitName }}"
        </template>
        <template v-else-if="entry.kind === 'exp-skill'">
          ✨ Used "{{ entry.habitName }}" — gained <span class="log-exp">+{{ Math.round(entry.amount) }}</span> EXP
        </template>
        <template v-else-if="entry.kind === 'hit'">
          💥 {{ entry.attackType === 'physical' ? 'Physical' : 'Magic' }} hit for
          <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage (missed "{{ entry.habitName }}")
        </template>
        <template v-else-if="entry.kind === 'level-up'">
          ⭐ Leveled up to Lv {{ entry.newLevel }}! Healed
          <span class="log-heal">+{{ Math.round(entry.healthRestored) }}</span> HP · Physical Dmg
          <span class="log-stat">+{{ Math.round(entry.statDeltas.physicalDamage) }}</span>
          · Magic Dmg
          <span class="log-stat">+{{ Math.round(entry.statDeltas.magicDamage) }}</span>
          · Healing
          <span class="log-stat">+{{ Math.round(entry.statDeltas.healing) }}</span>
          · Health
          <span class="log-stat">+{{ Math.round(entry.statDeltas.health) }}</span>
          · True Dmg
          <span class="log-true-damage">+{{ Math.round(entry.statDeltas.trueDamage) }}</span>
          · EXP Gain
          <span class="log-exp">+{{ Math.round(entry.statDeltas.expGain) }}</span>
        </template>
        <template v-else-if="entry.kind === 'crit'">
          💥 {{ entry.by === 'player' ? 'Critical hit!' : "Boss lands a critical hit!" }}
        </template>
        <template v-else-if="entry.kind === 'lifesteal'">
          🩸 Lifesteal
          {{ entry.healedWho === 'player' ? 'healed you' : 'restored the boss' }} for
          <span class="log-heal">+{{ Math.round(entry.amount) }}</span> HP
        </template>
        <template v-else-if="entry.kind === 'reflect'">
          🪞 Boss reflected <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage back at you
        </template>
        <template v-else-if="entry.kind === 'boss-defeated'">
          ☠️ Boss #{{ entry.bossIndex }} defeated!
        </template>
        <template v-else-if="entry.kind === 'special-assigned'">
          🌟 "{{ entry.habitName }}" is now your Special skill!
        </template>
        <template v-else-if="entry.kind === 'ult-assigned'">
          💫 "{{ entry.habitName }}" is now your Ult skill!
        </template>
        <template v-else-if="entry.kind === 'overdrive-granted'">
          🔥 "{{ entry.habitName }}" gained Overdrive!
        </template>
        <template v-else-if="entry.kind === 'wounds-applied'">
          🩹 Wounded for {{ entry.durationDays }} day(s) — healing at {{ (entry.effectRate * 100).toFixed(0) }}%
        </template>
      </li>
    </ul>
    <p v-else>No activity yet.</p>
  </section>
</template>

<style scoped>
.activity-log ul {
  list-style: disc;
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.activity-log li {
  font-size: 0.85rem;
  line-height: 1.4;
}

.log-damage {
  color: var(--damage-color);
  font-weight: 700;
}

.log-heal {
  color: var(--heal-color);
  font-weight: 700;
}

.log-stat {
  color: var(--stat-color);
  font-weight: 700;
}

.log-true-damage {
  color: var(--true-damage-color);
  font-weight: 700;
}

.log-exp {
  color: var(--exp-skill-color);
  font-weight: 700;
}
</style>
