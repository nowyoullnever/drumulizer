import { describe, expect, it } from 'vitest';
import { createPrng, normalizeSeed } from '../sequencer/generator/prng';

describe('generator PRNG', () => {
  it('normalizes seeds and reproduces finite values', () => {
    expect(normalizeSeed('  beat_01!!  ')).toBe('beat_01');
    expect(normalizeSeed('')).toBe('drumulizer-090');
    const first = createPrng('same-seed');
    const second = createPrng('same-seed');
    const values = Array.from({ length: 12 }, () => first.next());
    expect(values).toEqual(Array.from({ length: 12 }, () => second.next()));
    expect(values.every((value) => Number.isFinite(value) && value >= 0 && value < 1)).toBe(true);
  });
});
