import { TUNING } from './constants/tuning';
import { itemBonusPercent } from './items';
import type { Character } from './types';

export function expToNextLevel(level: number): number {
  if (level < 5) return 25 * level;
  if (level === 5) return 150;
  return Math.round((level ** 2 * 0.25 + 10 * level + 139.75) / 10) * 10;
}

/**
 * Grants EXP (scaled by an equipped expGain bonus) and resolves any
 * resulting level-ups. A lifesteal item bonus also heals the character a
 * tiny amount per level gained — `lifestealPct`% of max health (at the new
 * level) for each level crossed in this single grant.
 */
export function addExpAndResolveLevelUps(
  character: Character,
  expGained: number,
): { character: Character; levelsGained: number } {
  let { level, exp } = character;
  exp += expGained * (1 + itemBonusPercent(character, 'expGain') / 100);
  let levelsGained = 0;
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  let currentHealth = character.currentHealth;
  const lifestealPct = itemBonusPercent(character, 'lifesteal');
  if (levelsGained > 0 && lifestealPct > 0) {
    const maxHealth = statAtLevel(character.starterStats.health, level) * (1 + itemBonusPercent(character, 'health') / 100);
    currentHealth = Math.min(currentHealth + maxHealth * (lifestealPct / 100) * levelsGained, maxHealth);
  }

  return { character: { ...character, level, exp, currentHealth }, levelsGained };
}

export function statAtLevel(starterStatValue: number, level: number): number {
  return starterStatValue * Math.pow(1 + TUNING.LEVEL_STAT_GROWTH_RATE, level - 1);
}

/** statAtLevel(...) scaled by the character's equipped-item bonus for `stat`. */
export function effectiveStat(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health',
): number {
  const base = statAtLevel(character.starterStats[stat], character.level);
  return base * (1 + itemBonusPercent(character, stat) / 100);
}

/**
 * The character's crit chance (0-1) after equipped-item bonuses, capped at
 * TUNING.CRIT_CHANCE_CAP so a hit is never guaranteed no matter how many
 * crit items are stacked.
 */
export function effectiveCritChance(character: Character): number {
  const raw = character.critChance + itemBonusPercent(character, 'critChance') / 100;
  return Math.min(raw, TUNING.CRIT_CHANCE_CAP);
}
