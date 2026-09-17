import { TUNING } from './constants/tuning';
import { itemBonusPercent } from './items';
import type { Character } from './types';

export function expToNextLevel(level: number): number {
  if (level < 5) return 25 * level;
  if (level === 5) return 150;
  return Math.round((level ** 2 * 0.25 + 10 * level + 139.75) / 10) * 10;
}

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
  return { character: { ...character, level, exp }, levelsGained };
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
