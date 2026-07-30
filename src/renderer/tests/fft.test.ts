import { describe, expect, it } from 'vitest';
import { fftRadix2, positiveMagnitudes } from '../audio/onset/fft';

describe('onset FFT', () => {
  it('keeps zero and impulse transforms finite', () => {
    const zero = positiveMagnitudes(fftRadix2(new Float32Array(8)));
    expect([...zero].every(Number.isFinite)).toBe(true);
    expect([...zero].every((value) => value === 0)).toBe(true);

    const impulse = new Float32Array(8);
    impulse[0] = 1;
    const spectrum = positiveMagnitudes(fftRadix2(impulse));
    expect([...spectrum].every(Number.isFinite)).toBe(true);
    expect(spectrum[1]).toBeCloseTo(1, 5);
  });

  it('finds a known sine frequency peak', () => {
    const sampleRate = 1024;
    const size = 1024;
    const frequency = 128;
    const input = Float32Array.from({ length: size }, (_, index) =>
      Math.sin((2 * Math.PI * frequency * index) / sampleRate),
    );
    const magnitudes = positiveMagnitudes(fftRadix2(input));
    let maxBin = 0;
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      if (magnitudes[bin] > magnitudes[maxBin]) maxBin = bin;
    }
    expect(maxBin).toBe(128);
  });

  it('rejects non power-of-two input', () => {
    expect(() => fftRadix2(new Float32Array(7))).toThrow(/power of two/i);
  });
});
