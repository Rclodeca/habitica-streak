// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { lockBodyScroll } from './useBodyScrollLock';

describe('lockBodyScroll', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('hides body overflow while locked and restores it on release', () => {
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    release();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the lock until every stacked modal has released', () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();
    releaseA();
    expect(document.body.style.overflow).toBe('hidden');
    releaseB();
    expect(document.body.style.overflow).toBe('');
  });

  it('ignores a double release', () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();
    releaseA();
    releaseA();
    expect(document.body.style.overflow).toBe('hidden');
    releaseB();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores a pre-existing overflow value', () => {
    document.body.style.overflow = 'scroll';
    const release = lockBodyScroll();
    release();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
