<script setup lang="ts">
import { useActivityLogStore } from '../../store/activityLogStore';
import StatIcon from './StatIcon.vue';

const activityLogStore = useActivityLogStore();
</script>

<template>
  <section class="panel activity-log">
    <h2>Log</h2>
    <ul v-if="activityLogStore.entries.length">
      <li v-for="entry in activityLogStore.entries" :key="entry.id">
        <template v-if="entry.kind === 'skill-damage'">
          <StatIcon :name="entry.isTrueDamage ? 'true' : 'physical'" class="log-icon" /> Used "{{ entry.habitName }}" — dealt
          <span :class="entry.isTrueDamage ? 'log-true-damage' : 'log-damage'">{{ Math.round(entry.amount) }}</span>
          damage
          <template v-if="entry.milestoneExp">
            · <span class="log-exp">+{{ Math.round(entry.milestoneExp) }}</span> EXP
          </template>
        </template>
        <template v-else-if="entry.kind === 'heal'">
          <StatIcon name="healing" class="log-icon" /> Healed <span class="log-heal">+{{ Math.round(entry.amount) }}</span> HP using "{{ entry.habitName }}"
          <template v-if="entry.milestoneExp">
            · <span class="log-exp">+{{ Math.round(entry.milestoneExp) }}</span> EXP
          </template>
        </template>
        <template v-else-if="entry.kind === 'hit'">
          <StatIcon :name="entry.attackType === 'physical' ? 'physical' : 'magic'" class="log-icon" /> {{ entry.attackType === 'physical' ? 'Physical' : 'Magic' }} hit for
          <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage (missed "{{ entry.habitName }}")
        </template>
        <template v-else-if="entry.kind === 'level-up'">
          <StatIcon name="levelUp" class="log-icon" /> Leveled up to Lv. {{ entry.newLevel }}! Healed
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
        </template>
        <template v-else-if="entry.kind === 'crit'">
          <StatIcon name="crit" class="log-icon" /> {{ entry.by === 'player' ? 'Critical hit!' : "Boss lands a critical hit!" }}
        </template>
        <template v-else-if="entry.kind === 'lifesteal'">
          <StatIcon name="lifesteal" class="log-icon" /> Lifesteal
          {{ entry.healedWho === 'player' ? 'healed you' : 'restored the boss' }} for
          <span class="log-heal">+{{ Math.round(entry.amount) }}</span> HP
        </template>
        <template v-else-if="entry.kind === 'reflect'">
          <StatIcon name="reflect" class="log-icon" /> Boss reflected <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage back at you
        </template>
        <template v-else-if="entry.kind === 'boss-defeated'">
          <StatIcon name="skull" class="log-icon" /> Boss #{{ entry.bossIndex }} defeated!
          <template v-if="entry.amount">
            <span class="log-exp">+{{ Math.round(entry.amount) }}</span> EXP
          </template>
        </template>
        <template v-else-if="entry.kind === 'special-assigned'">
          <StatIcon name="special" class="log-icon" /> "{{ entry.habitName }}" is now your Special skill!
        </template>
        <template v-else-if="entry.kind === 'ult-assigned'">
          <StatIcon name="ult" class="log-icon" /> "{{ entry.habitName }}" is now your Ult skill!
        </template>
        <template v-else-if="entry.kind === 'overdrive-granted'">
          <StatIcon name="streak" class="log-icon" /> "{{ entry.habitName }}" gained Overdrive!
        </template>
        <template v-else-if="entry.kind === 'event-heal'">
          <StatIcon name="healing" class="log-icon" /> Restored <span class="log-heal">+{{ Math.round(entry.amount) }}</span> HP
        </template>
        <template v-else-if="entry.kind === 'item-doubled'">
          <StatIcon name="itemDoubled" class="log-icon" /> "{{ entry.itemName }}" now has double stats!
        </template>
        <template v-else-if="entry.kind === 'heal-boost-gained'">
          <StatIcon name="healBoost" class="log-icon" /> Healing boosted for {{ entry.days }} days
        </template>
        <template v-else-if="entry.kind === 'crit-boost-gained'">
          <StatIcon name="critBoost" class="log-icon" /> Crit chance boosted for {{ entry.days }} days
        </template>
        <template v-else-if="entry.kind === 'item-slots-gained'">
          <StatIcon name="slots" class="log-icon" /> Item slots increased to 6!
        </template>
        <template v-else-if="entry.kind === 'skill-rerolled'">
          <StatIcon name="reroll" class="log-icon" /> "{{ entry.habitName }}" was re-rolled to {{ entry.damageType }}
        </template>
        <template v-else-if="entry.kind === 'wounds-applied'">
          <StatIcon name="wounds" class="log-icon" /> Wounded for {{ entry.durationDays }} day(s) — healing at {{ (entry.effectRate * 100).toFixed(0) }}%
        </template>
        <template v-else-if="entry.kind === 'quest-completed'">
          <StatIcon name="quest" class="log-icon" /> Completed quest "{{ entry.description }}" —
          <template v-if="entry.itemName">found {{ entry.itemName }}</template>
          <template v-else>gained <span class="log-exp">+{{ Math.round(entry.amount) }}</span> EXP</template>
        </template>
        <template v-else-if="entry.kind === 'quest-failed'">
          <StatIcon name="quest" class="log-icon" /> Missed quest "{{ entry.description }}" — took <span class="log-damage">{{ Math.round(entry.amount) }}</span> damage
        </template>
      </li>
    </ul>
    <p v-else>No activity yet.</p>
  </section>
</template>

<style scoped>
.activity-log ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.activity-log li {
  font-size: 0.85rem;
  line-height: 1.4;
}

.log-icon {
  margin-right: 0.4rem;
  margin-top: -2px;
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
