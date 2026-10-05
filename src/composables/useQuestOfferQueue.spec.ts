// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useQuestOfferQueue } from './useQuestOfferQueue';

describe('useQuestOfferQueue', () => {
  // `queue` is a module-scope singleton by design (mirrors useItemDropQueue)
  // — drain it after every test so one test's offer can't leak into another.
  afterEach(() => {
    const { current, dismiss } = useQuestOfferQueue();
    while (current.value !== null) dismiss();
  });

  it('starts with no current offer', () => {
    const { current } = useQuestOfferQueue();
    expect(current.value).toBeNull();
  });

  it('enqueueOffer makes the offered boss index current', () => {
    const { current, enqueueOffer } = useQuestOfferQueue();
    enqueueOffer(5);
    expect(current.value).toBe(5);
  });

  it('dismiss advances to the next queued offer', () => {
    const { current, enqueueOffer, dismiss } = useQuestOfferQueue();
    enqueueOffer(3);
    enqueueOffer(7);
    expect(current.value).toBe(3);
    dismiss();
    expect(current.value).toBe(7);
    dismiss();
    expect(current.value).toBeNull();
  });
});
