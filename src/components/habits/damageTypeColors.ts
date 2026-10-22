import type { DamageType } from '../../game-engine';

// CSS variables (defined in style.css, restyled per theme).
export const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  healing: 'var(--dmg-healing)',
  physical: 'var(--dmg-physical)',
  magic: 'var(--dmg-magic)',
  trueDamage: 'var(--dmg-true)',
};

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  healing: 'Healing',
  physical: 'Physical',
  magic: 'Magic',
  trueDamage: 'True',
};
