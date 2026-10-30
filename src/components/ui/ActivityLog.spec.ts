// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useActivityLogStore } from '../../store/activityLogStore';
import ActivityLog from './ActivityLog.vue';

enableAutoUnmount(afterEach);

describe('ActivityLog — boss skills', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const lineFor = (entry: Parameters<ReturnType<typeof useActivityLogStore>['addEntry']>[0]) => {
    useActivityLogStore().addEntry(entry);
    return mount(ActivityLog).find('li').text().replace(/\s+/g, ' ').trim();
  };

  it.each([
    [{ kind: 'boss-skill', skill: 'rend', outcome: 'landed', amount: 200.4 }, 'Rend — took 200 damage'],
    [{ kind: 'boss-skill', skill: 'ravage', outcome: 'landed', amount: 400 }, 'Ravage — took 400 damage'],
    [{ kind: 'boss-skill', skill: 'mend', outcome: 'landed', amount: 1000 }, 'The boss mends +1K'],
    [{ kind: 'boss-skill', skill: 'bloodlust', outcome: 'landed' }, 'Bloodlust · 2 days Boss heals 3% per hit'],
    [{ kind: 'boss-skill', skill: 'reflect', outcome: 'landed' }, 'Reflect · 2 days Reflects 5% of your damage'],
    [{ kind: 'boss-skill', skill: 'blind', outcome: 'landed' }, 'Blinded · 2 days No crits'],
    [{ kind: 'boss-skill', skill: 'sever', outcome: 'landed' }, 'Severed · 2 days No lifesteal'],
    [{ kind: 'boss-skill', skill: 'sunder', outcome: 'landed' }, 'Sundered · 2 days Armor & resist halved'],
    [{ kind: 'boss-skill', skill: 'doom', outcome: 'landed', pct: 50 }, 'Doom · 3 days Half your HP'],
    [{ kind: 'boss-skill', skill: 'doom', outcome: 'landed', pct: 25 }, 'Doom · 3 days A quarter of your HP'],
    [{ kind: 'boss-skill', skill: 'undying', outcome: 'landed' }, 'Undying · today Can\'t fall below 10%'],
    [{ kind: 'boss-skill', skill: 'empower', outcome: 'landed', stat: 'armor' }, 'Empower Armor doubled'],
    [{ kind: 'boss-skill', skill: 'empower', outcome: 'landed', stat: 'magicAttack' }, 'Empower Magic attack doubled'],
    [{ kind: 'boss-skill', skill: 'ascend', outcome: 'landed' }, 'Ascend All stats doubled'],
    [{ kind: 'boss-skill', skill: 'wounds', outcome: 'resisted' }, 'Wounds resisted'],
    [{ kind: 'boss-skill', skill: 'mend', outcome: 'resisted' }, 'Mend resisted'],
    [{ kind: 'boss-skill', skill: 'blind', outcome: 'resisted' }, 'Blind resisted'],
    [{ kind: 'boss-skill', skill: 'doom', outcome: 'failed' }, 'A boss skill fails'],
    [{ kind: 'doom-landed', amount: 512.6 }, 'Doom — took 513 damage'],
    [{ kind: 'rank-up', habitName: 'Run', rank: 5 }, '"Run" · Rank V'],
    [{ kind: 'skill-damage', habitName: 'Run', amount: 500, crit: true, lifesteal: 80, reflected: 120, milestoneExp: 42 }, 'Used "Run" — dealt 500 damage Crit+80 HP−120 HP+42 EXP'],
    [{ kind: 'skill-damage', habitName: 'Run', amount: 500 }, 'Used "Run" — dealt 500 damage'],
    [{ kind: 'hit', habitName: 'Run', amount: 412, attackType: 'magic', crit: true, lifesteal: 95 }, 'Missed "Run" — took 412 damage CritBoss +95 HP'],
  ] as const)('renders %o as "%s"', (entry, text) => {
    expect(lineFor(entry)).toBe(text);
  });
});
