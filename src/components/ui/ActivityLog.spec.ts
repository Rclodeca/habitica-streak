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
    [{ kind: 'boss-skill', skill: 'mend', outcome: 'landed', amount: 1000 }, 'The boss mends +1000'],
    [{ kind: 'boss-skill', skill: 'bloodlust', outcome: 'landed' }, 'Bloodlust · 2 days'],
    [{ kind: 'boss-skill', skill: 'blind', outcome: 'landed' }, 'Blinded · 2 days'],
    [{ kind: 'boss-skill', skill: 'sunder', outcome: 'landed' }, 'Sundered · 2 days'],
    [{ kind: 'boss-skill', skill: 'doom', outcome: 'landed' }, 'Doom falls in 3 days'],
    [{ kind: 'boss-skill', skill: 'undying', outcome: 'landed' }, 'Undying until tomorrow'],
    [{ kind: 'boss-skill', skill: 'wounds', outcome: 'resisted' }, 'Wounds resisted'],
    [{ kind: 'boss-skill', skill: 'doom', outcome: 'failed' }, 'A boss skill fails'],
    [{ kind: 'doom-landed', amount: 512.6 }, 'Doom — took 513 damage'],
  ] as const)('renders %o as "%s"', (entry, text) => {
    expect(lineFor(entry)).toBe(text);
  });
});
