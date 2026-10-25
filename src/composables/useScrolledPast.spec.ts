// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import type { Ref } from 'vue';
import { useScrolledPast } from './useScrolledPast';

enableAutoUnmount(afterEach);

describe('useScrolledPast', () => {
  let rect: { bottom: number; height: number };

  beforeEach(() => {
    rect = { bottom: 300, height: 256 };
    vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Mounts a host whose element reports `rect`, with a 70px bar covering the top.
  function mountHost() {
    let past: Ref<boolean> | undefined;
    const Host = defineComponent(() => {
      const el = ref<HTMLElement | null>(null);
      past = useScrolledPast(el, () => 70);
      return () => h('div', { ref: el });
    });
    const wrapper = mount(Host, { attachTo: document.body });
    wrapper.element.getBoundingClientRect = () => ({ ...new DOMRect().toJSON(), bottom: rect.bottom, height: rect.height });
    return { past: past!, wrapper };
  }

  function scrollTo(bottom: number) {
    rect.bottom = bottom;
    window.dispatchEvent(new Event('scroll'));
  }

  it('flips once the element has gone up behind the bar, and back', () => {
    const { past } = mountHost();
    scrollTo(300);
    expect(past.value).toBe(false);

    scrollTo(71);
    expect(past.value).toBe(false);

    scrollTo(69);
    expect(past.value).toBe(true);

    scrollTo(120);
    expect(past.value).toBe(false);
  });

  it('stays off while the element takes no space', () => {
    const { past } = mountHost();
    rect.height = 0;
    scrollTo(0);
    expect(past.value).toBe(false);
  });

  it('stops listening once unmounted', () => {
    const { past, wrapper } = mountHost();
    wrapper.unmount();
    scrollTo(0);
    expect(past.value).toBe(false);
  });
});
