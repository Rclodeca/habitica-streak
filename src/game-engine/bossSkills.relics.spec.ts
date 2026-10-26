import { describe, expect, it, vi } from 'vitest';
import { resolveBreakpoints } from './bossSkills';
import type { Boss, BossSkillSlot, Character } from './types';

// Hushing Bell and Omen Hourglass have no art yet, so they aren't in the
// catalog; this file alone adds them, so the effects can be tested now.
vi.mock('./constants/itemCatalog', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./constants/itemCatalog')>();
  return {
    ITEM_CATALOG: [
      ...mod.ITEM_CATALOG,
      { id: 'hushing-bell', name: 'Hushing Bell', icon: 'items/hushing-bell', type: 'equipment', rarity: 'relic', unlockLevel: 1, bonuses: [], effect: 'hushing-bell', effectText: 'Boss skills have a 50% chance to fail.' },
      { id: 'omen-hourglass', name: 'Omen Hourglass', icon: 'items/omen-hourglass', type: 'equipment', rarity: 'relic', unlockLevel: 1, bonuses: [], effect: 'omen-hourglass', effectText: 'Boss skills deal half damage.' },
    ],
  };
});

const DAY = '2026-01-01';

const hero = (equipped: string[], currentHealth = 500): Character => ({
  level: 1,
  exp: 0,
  starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50, trueDamage: 6 },
  currentHealth,
  ownedItemIds: equipped,
  equippedItemIds: equipped,
  critChance: 0.01,
});

/** A boss just hit from 60% to 40%, past a skill waiting at 50%. */
const hitBoss = (skill: BossSkillSlot['skill']): Boss => ({
  index: 30,
  personality: 'balanced',
  maxHealth: 1000,
  health: 400,
  physicalAttack: 20,
  magicAttack: 20,
  armor: 10,
  magicResist: 10,
  critChance: 0,
  reflectPct: 0,
  lifestealPct: 0,
  skills: [{ at: 0.5, skill }],
});

describe('Hushing Bell', () => {
  it('makes a skill fail on a roll under 50%, spending its breakpoint', () => {
    const character = hero(['hushing-bell']);
    const result = resolveBreakpoints(600, hitBoss('rend'), character, DAY, () => 0.3);
    expect(result.fired).toEqual({ skill: 'rend', outcome: 'failed' });
    expect(result.character).toBe(character);
    expect(result.boss.skills).toEqual([{ at: 0.5, skill: 'rend', spent: true, fired: true }]);
  });

  it('lets the skill land on a roll of 50% or more', () => {
    const result = resolveBreakpoints(600, hitBoss('rend'), hero(['hushing-bell']), DAY, () => 0.7);
    expect(result.fired?.outcome).toBe('landed');
    expect(result.character.currentHealth).toBeCloseTo(400, 10);
  });
});

describe('Omen Hourglass', () => {
  it('halves Rend to 10% and Ravage to 20%', () => {
    expect(resolveBreakpoints(600, hitBoss('rend'), hero(['omen-hourglass']), DAY, () => 0.99).character.currentHealth).toBeCloseTo(450, 10);
    expect(resolveBreakpoints(600, hitBoss('ravage'), hero(['omen-hourglass']), DAY, () => 0.99).character.currentHealth).toBeCloseTo(400, 10);
  });
});
