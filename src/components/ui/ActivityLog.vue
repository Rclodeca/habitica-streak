<script setup lang="ts">
import { bossSkillEffectText, formatCompact } from '../../game-engine';
import { useActivityLogStore } from '../../store/activityLogStore';
import { rankNumeral } from '../habits/habitDisplay';
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
          <span :class="entry.isTrueDamage ? 'log-true-damage' : 'log-damage'">{{ formatCompact(entry.amount) }}</span>
          damage
          <span v-if="entry.crit || entry.lifesteal || entry.reflected || entry.milestoneExp" class="log-chips">
            <span v-if="entry.crit" class="log-chip crit"><StatIcon name="crit" :size="11" />Crit</span>
            <span v-if="entry.lifesteal" class="log-chip"><StatIcon name="lifesteal" :size="11" /><span class="log-heal">+{{ formatCompact(entry.lifesteal) }}</span>&nbsp;HP</span>
            <span v-if="entry.reflected" class="log-chip"><StatIcon name="reflect" :size="11" /><span class="log-damage">−{{ formatCompact(entry.reflected) }}</span>&nbsp;HP</span>
            <span v-if="entry.milestoneExp" class="log-chip"><span class="log-exp">+{{ formatCompact(entry.milestoneExp) }}</span>&nbsp;EXP</span>
          </span>
        </template>
        <template v-else-if="entry.kind === 'heal'">
          <StatIcon name="healing" class="log-icon" /> Healed <span class="log-heal">+{{ formatCompact(entry.amount) }}</span> HP using "{{ entry.habitName }}"
          <template v-if="entry.milestoneExp">
            · <span class="log-exp">+{{ formatCompact(entry.milestoneExp) }}</span> EXP
          </template>
        </template>
        <template v-else-if="entry.kind === 'hit'">
          <StatIcon :name="entry.attackType === 'physical' ? 'physical' : 'magic'" class="log-icon" /> Missed "{{ entry.habitName }}" — took
          <span class="log-damage">{{ formatCompact(entry.amount) }}</span> damage
          <span v-if="entry.crit || entry.lifesteal" class="log-chips">
            <span v-if="entry.crit" class="log-chip crit"><StatIcon name="crit" :size="11" />Crit</span>
            <span v-if="entry.lifesteal" class="log-chip"><StatIcon name="lifesteal" :size="11" />Boss&nbsp;<span class="log-heal">+{{ formatCompact(entry.lifesteal) }}</span>&nbsp;HP</span>
          </span>
        </template>
        <template v-else-if="entry.kind === 'level-up'">
          <StatIcon name="levelUp" class="log-icon" /> Leveled up to Lv. {{ entry.newLevel }}! Healed
          <span class="log-heal">+{{ formatCompact(entry.healthRestored) }}</span> HP · Physical Dmg
          <span class="log-stat">+{{ formatCompact(entry.statDeltas.physicalDamage) }}</span>
          · Magic Dmg
          <span class="log-stat">+{{ formatCompact(entry.statDeltas.magicDamage) }}</span>
          · Healing
          <span class="log-stat">+{{ formatCompact(entry.statDeltas.healing) }}</span>
          · Health
          <span class="log-stat">+{{ formatCompact(entry.statDeltas.health) }}</span>
          · True Dmg
          <span class="log-true-damage">+{{ formatCompact(entry.statDeltas.trueDamage) }}</span>
        </template>
        <template v-else-if="entry.kind === 'crit'">
          <StatIcon name="crit" class="log-icon" /> {{ entry.by === 'player' ? 'Critical hit!' : "Boss lands a critical hit!" }}
        </template>
        <template v-else-if="entry.kind === 'lifesteal'">
          <StatIcon name="lifesteal" class="log-icon" /> Lifesteal
          {{ entry.healedWho === 'player' ? 'healed you' : 'restored the boss' }} for
          <span class="log-heal">+{{ formatCompact(entry.amount) }}</span> HP
        </template>
        <template v-else-if="entry.kind === 'reflect'">
          <StatIcon name="reflect" class="log-icon" /> Boss reflected <span class="log-damage">{{ formatCompact(entry.amount) }}</span> damage back at you
        </template>
        <template v-else-if="entry.kind === 'boss-defeated'">
          <StatIcon name="skull" class="log-icon" /> Boss #{{ entry.bossIndex }} defeated!
          <template v-if="entry.amount">
            <span class="log-exp">+{{ formatCompact(entry.amount) }}</span> EXP
          </template>
        </template>
        <template v-else-if="entry.kind === 'special-assigned'">
          <StatIcon name="special" class="log-icon" /> "{{ entry.habitName }}" is now your Special skill!
        </template>
        <template v-else-if="entry.kind === 'ult-assigned'">
          <StatIcon name="ult" class="log-icon" /> "{{ entry.habitName }}" is now your Ult skill!
        </template>
        <template v-else-if="entry.kind === 'rank-up'">
          <StatIcon name="streak" class="log-icon" /> "{{ entry.habitName }}" · Rank {{ rankNumeral(entry.rank) }}
        </template>
        <template v-else-if="entry.kind === 'overdrive-granted'">
          <StatIcon name="streak" class="log-icon" /> "{{ entry.habitName }}" gained Overdrive!
        </template>
        <template v-else-if="entry.kind === 'event-heal'">
          <StatIcon name="healing" class="log-icon" /> Restored <span class="log-heal">+{{ formatCompact(entry.amount) }}</span> HP
        </template>
        <template v-else-if="entry.kind === 'item-heal'">
          <StatIcon name="healing" class="log-icon" /> {{ entry.itemName }} <span class="log-heal">+{{ formatCompact(entry.amount) }}</span> HP
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
          <StatIcon name="slots" class="log-icon" /> Item slots increased to {{ entry.slots ?? 6 }}!
        </template>
        <template v-else-if="entry.kind === 'skill-rerolled'">
          <StatIcon name="reroll" class="log-icon" /> "{{ entry.habitName }}" was re-rolled to {{ entry.damageType }}
        </template>
        <template v-else-if="entry.kind === 'wounds-applied'">
          <StatIcon name="wounds" class="log-icon" /> Wounded for {{ entry.durationDays }} day(s) — healing at {{ (entry.effectRate * 100).toFixed(0) }}%
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.outcome === 'failed'">
          <StatIcon name="skillFailed" class="log-icon" /> A boss skill fails
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.outcome === 'resisted'">
          <StatIcon name="wounds" class="log-icon" /> Wounds resisted
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && (entry.skill === 'rend' || entry.skill === 'ravage')">
          <StatIcon name="bossHit" class="log-icon" /> {{ entry.skill === 'rend' ? 'Rend' : 'Ravage' }} — took
          <span class="log-damage">{{ formatCompact(entry.amount ?? 0) }}</span> damage
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'mend'">
          <StatIcon name="mend" class="log-icon" /> The boss mends <span class="log-heal">+{{ formatCompact(entry.amount ?? 0) }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'bloodlust'">
          <StatIcon name="bloodlust" class="log-icon" /> Bloodlust · 2 days
          <span class="log-effect">{{ bossSkillEffectText('bloodlust') }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'reflect'">
          <StatIcon name="reflect" class="log-icon" /> Reflect · 2 days
          <span class="log-effect">{{ bossSkillEffectText('reflect') }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'blind'">
          <StatIcon name="blind" class="log-icon" /> Blinded · 2 days
          <span class="log-effect">{{ bossSkillEffectText('blind') }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'sunder'">
          <StatIcon name="sunder" class="log-icon" /> Sundered · 2 days
          <span class="log-effect">{{ bossSkillEffectText('sunder') }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'doom'">
          <StatIcon name="doom" class="log-icon" /> Doom · 3 days
          <span class="log-effect">{{ bossSkillEffectText('doom', entry.pct) }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && entry.skill === 'undying'">
          <StatIcon name="undying" class="log-icon" /> Undying · today
          <span class="log-effect">{{ bossSkillEffectText('undying') }}</span>
        </template>
        <template v-else-if="entry.kind === 'boss-skill' && (entry.skill === 'empower' || entry.skill === 'ascend')">
          <StatIcon :name="entry.skill" class="log-icon" /> {{ entry.skill === 'empower' ? 'Empower' : 'Ascend' }}
          <span class="log-effect">{{ bossSkillEffectText(entry.skill, undefined, entry.stat) }}</span>
        </template>
        <template v-else-if="entry.kind === 'doom-landed'">
          <StatIcon name="doom" class="log-icon" /> Doom — took <span class="log-damage">{{ formatCompact(entry.amount) }}</span> damage
        </template>
        <template v-else-if="entry.kind === 'quest-completed'">
          <StatIcon name="quest" class="log-icon" /> Completed quest "{{ entry.description }}" —
          <template v-if="entry.itemName">found {{ entry.itemName }}</template>
          <template v-else>gained <span class="log-exp">+{{ formatCompact(entry.amount) }}</span> EXP</template>
        </template>
        <template v-else-if="entry.kind === 'quest-failed'">
          <StatIcon name="quest" class="log-icon" /> Missed quest "{{ entry.description }}" — took <span class="log-damage">{{ formatCompact(entry.amount) }}</span> damage
        </template>
      </li>
    </ul>
    <p v-else>No activity yet.</p>
  </section>
  <div class="log-end" aria-hidden="true">
    <span class="log-end-rule" />
    <span class="log-end-gem small" />
    <span class="log-end-gem" />
    <span class="log-end-gem small" />
    <span class="log-end-rule flip" />
  </div>
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

/* What a boss skill does, under its name. */
.log-effect {
  display: block;
  margin-left: 1.4rem;
  color: var(--text);
  font-style: italic;
}

/* A blow's crit, lifesteal, reflect and EXP, on a row under it. */
.log-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.2rem 0 0 1.4rem;
}

.log-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0 0.4rem;
  border: 1px solid var(--accent-border);
  font-size: 0.75rem;
  font-style: normal;
  line-height: 1.4;
  color: var(--text);
}

.log-chip.crit {
  border-color: color-mix(in srgb, var(--icon-crit) 50%, transparent);
  color: var(--icon-crit);
}

.log-true-damage {
  color: var(--true-damage-color);
  font-weight: 700;
}

.log-exp {
  color: var(--exp-skill-color);
  font-weight: 700;
}

/* Closes off the bottom of the page, clear of the phone's home indicator. */
.log-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom));
}

.log-end-rule {
  width: 4.5rem;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-border));
}

.log-end-rule.flip {
  transform: scaleX(-1);
}

.log-end-gem {
  box-sizing: border-box;
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
  border: 1px solid var(--accent-solid);
  background: var(--bg);
}

.log-end-gem.small {
  width: 4px;
  height: 4px;
  border-color: var(--accent-border);
  background: var(--accent-border);
}
</style>
