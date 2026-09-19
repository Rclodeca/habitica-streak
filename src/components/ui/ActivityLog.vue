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
          ⚔️ Used "{{ entry.habitName }}" — dealt
          <span class="log-damage">{{ Math.round(entry.amount) }}</span>
          damage
        </template>
        <template v-else-if="entry.kind === 'heal'">
          💚 Healed <span class="log-heal">+{{ Math.round(entry.amount) }}</span> HP using "{{ entry.habitName }}"
        </template>
        <template v-else-if="entry.kind === 'hit'">
          💥 Hit for <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage (missed "{{
            entry.habitName
          }}")
        </template>
        <template v-else-if="entry.kind === 'level-up'">
          ⭐ Leveled up to Lv {{ entry.newLevel }}! Physical Dmg
          <span class="log-stat">+{{ Math.round(entry.statDeltas.physicalDamage) }}</span>
          · Magic Dmg
          <span class="log-stat">+{{ Math.round(entry.statDeltas.magicDamage) }}</span>
          · Healing
          <span class="log-stat">+{{ Math.round(entry.statDeltas.healing) }}</span>
          · Health
          <span class="log-stat">+{{ Math.round(entry.statDeltas.health) }}</span>
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
          🔮 Boss reflected <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage back at you
        </template>
        <template v-else-if="entry.kind === 'boss-defeated'">
          ☠️ Boss #{{ entry.bossIndex }} defeated!
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
</style>
