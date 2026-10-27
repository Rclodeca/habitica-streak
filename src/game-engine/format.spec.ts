import { describe, expect, it } from 'vitest';
import { formatCompact } from './format';

describe('formatCompact', () => {
  it('rounds to a whole number below 1000', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(7.4)).toBe('7');
    expect(formatCompact(999.4)).toBe('999');
  });

  it('shows thousands to three digits, cut not rounded', () => {
    expect(formatCompact(1345)).toBe('1.34K');
    expect(formatCompact(1999)).toBe('1.99K');
    expect(formatCompact(9999)).toBe('9.99K');
    expect(formatCompact(18987)).toBe('18.9K');
  });

  it('drops trailing zeros', () => {
    expect(formatCompact(1000)).toBe('1K');
    expect(formatCompact(1300)).toBe('1.3K');
    expect(formatCompact(2050)).toBe('2.05K');
    expect(formatCompact(10040)).toBe('10K');
  });

  it('drops the decimal from 100K up', () => {
    expect(formatCompact(99999)).toBe('99.9K');
    expect(formatCompact(100000)).toBe('100K');
    expect(formatCompact(123456)).toBe('123K');
    expect(formatCompact(999999)).toBe('999K');
  });

  it('switches to M at a million, on the same rule', () => {
    expect(formatCompact(1000000)).toBe('1M');
    expect(formatCompact(1259000)).toBe('1.25M');
    expect(formatCompact(12590000)).toBe('12.5M');
    expect(formatCompact(99999999)).toBe('99.9M');
    expect(formatCompact(123456789)).toBe('123M');
  });

  it('switches to B at a billion and T at a trillion, on the same rule', () => {
    expect(formatCompact(999999999)).toBe('999M');
    expect(formatCompact(1000000000)).toBe('1B');
    expect(formatCompact(6780000000)).toBe('6.78B');
    expect(formatCompact(123456789012)).toBe('123B');
    expect(formatCompact(1000000000000)).toBe('1T');
    expect(formatCompact(5040000000000)).toBe('5.04T');
    expect(formatCompact(2790000000000000)).toBe('2790T');
  });

  it('rounds to whole before deciding it has reached 1000', () => {
    expect(formatCompact(999.6)).toBe('1K');
  });

  it('keeps the sign', () => {
    expect(formatCompact(-1345)).toBe('-1.34K');
    expect(formatCompact(-0.3)).toBe('0');
  });
});
