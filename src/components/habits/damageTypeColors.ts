import type { DamageType } from '../../game-engine';

export const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  healing: '#22c55e',
  physical: '#f87171',
  magic: '#b98cfb',
  trueDamage: '#f9fafb',
};

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  healing: 'Healing',
  physical: 'Physical',
  magic: 'Magic',
  trueDamage: 'True',
};
