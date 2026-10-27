<script setup lang="ts">
import { computed } from 'vue';
import { useBossSkillCard } from '../../composables/useBossSkillCard';
import { useModalPriority } from '../../composables/useModalPriority';
import { bossSkillEffectText, formatCompact } from '../../game-engine';
import type { BossSkillId, FiredBossSkill } from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import type { StatIconName } from '../ui/statIcons';

const { current, dismiss } = useBossSkillCard();
const { bossSkillVisible } = useModalPriority();

const S = TUNING.BOSS_SKILLS;

const SKILL: Record<BossSkillId, { name: string; icon: StatIconName }> = {
  wounds: { name: 'Wounds', icon: 'wounds' },
  bloodlust: { name: 'Bloodlust', icon: 'bloodlust' },
  reflect: { name: 'Reflect', icon: 'reflect' },
  blind: { name: 'Blind', icon: 'blind' },
  mend: { name: 'Mend', icon: 'mend' },
  rend: { name: 'Rend', icon: 'bossHit' },
  doom: { name: 'Doom', icon: 'doom' },
  sunder: { name: 'Sunder', icon: 'sunder' },
  undying: { name: 'Undying', icon: 'undying' },
  ravage: { name: 'Ravage', icon: 'bossHit' },
};

interface Card {
  name: string;
  icon: StatIconName;
  /** The effect, in the log's words; `amount` lines get the damage or heal colour. */
  line?: string;
  tone?: 'damage' | 'heal';
}

// A failed skill stays unnamed, as in the log.
function cardFor(fired: FiredBossSkill): Card {
  if (fired.outcome === 'failed') return { name: 'Failed', icon: 'skillFailed' };
  const { name, icon } = SKILL[fired.skill];
  if (fired.outcome === 'resisted') return { name, icon, line: 'Resisted' };
  const days = `${S.DURATION_DAYS} days`;
  switch (fired.skill) {
    case 'rend':
    case 'ravage':
      return { name, icon, line: `−${formatCompact(fired.amount ?? 0)} HP`, tone: 'damage' };
    case 'mend':
      return { name, icon, line: `Boss +${formatCompact(fired.amount ?? 0)} HP`, tone: 'heal' };
    case 'wounds':
      return { name, icon, line: `Healing at ${S.WOUNDS_EFFECT_RATE * 100}% · ${days}` };
    case 'doom':
      return { name, icon, line: `${bossSkillEffectText('doom', fired.pct)} · ${S.DOOM_DELAY_DAYS} days` };
    case 'undying':
      return { name, icon, line: `${bossSkillEffectText('undying')} · today` };
    default:
      return { name, icon, line: `${bossSkillEffectText(fired.skill)} · ${days}` };
  }
}

const card = computed(() => (current.value ? cardFor(current.value) : null));
</script>

<template>
  <Modal :model-value="bossSkillVisible" title="Boss skill" max-width="380px" @update:model-value="dismiss">
    <div v-if="card" :key="`${current?.skill}-${current?.outcome}`" class="hero skill-card">
      <div class="seal" aria-hidden="true">
        <StatIcon :name="card.icon" :size="40" />
      </div>
      <p class="skill-name">{{ card.name }}</p>
      <p v-if="card.line" class="skill-line" :class="card.tone">{{ card.line }}</p>
    </div>
    <button type="button" class="ok primary-button" @click="dismiss">OK</button>
  </Modal>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  background: var(--code-bg);
  border: 1px solid color-mix(in srgb, var(--damage-color) 55%, transparent);
  border-radius: 12px;
  box-shadow: 0 0 24px -6px var(--damage-color);
  text-align: center;
  animation: rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.seal {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, color-mix(in srgb, var(--damage-color) 18%, transparent), transparent 70%);
  border: 2px solid color-mix(in srgb, var(--damage-color) 60%, transparent);
  border-radius: 50%;
}

.seal :deep(svg) {
  filter: drop-shadow(0 0 8px currentColor);
}

.skill-name {
  margin: 0.25rem 0 0;
  color: var(--text-h);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.skill-line {
  margin: 0;
  color: var(--text-h);
  font-size: 1.05rem;
}

.skill-line.damage {
  color: var(--damage-color);
  font-weight: 700;
}

.skill-line.heal {
  color: var(--heal-color);
  font-weight: 700;
}

.ok {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 0.75rem;
  padding: 0.8rem 1.2rem;
  letter-spacing: 0.04em;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero {
    animation: none;
  }
}
</style>
