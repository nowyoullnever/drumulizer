import { describe, expect, it } from 'vitest';
import {
  chooseFrameConfig,
  mapAnalysisSampleToSource,
  preprocessOnsetPcm,
} from '../audio/onset/preprocess';

describe('onset preprocessing', () => {
  it('removes DC, replaces non-finite values, and keeps finite output', () => {
    const source = new Float32Array([1, 1, 1, Number.NaN, 1.5, 0.5]);
    const result = preprocessOnsetPcm(source, 12000);
    expect([...result.samples].every(Number.isFinite)).toBe(true);
    const mean = [...result.samples].reduce((sum, value) => sum + value, 0) / result.samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.001);
  });

  it('detects silence and handles low-rate sources without upsampling', () => {
    const silent = preprocessOnsetPcm(new Float32Array(1000), 8000);
    expect(silent.silent).toBe(true);
    expect(silent.analysisSampleRate).toBe(8000);
    expect(chooseFrameConfig(8000).frameSize).toBeGreaterThanOrEqual(64);
  });

  it('downsamples high-rate sources with deterministic source mapping', () => {
    const input = Float32Array.from({ length: 48000 }, (_, index) => Math.sin(index / 10));
    const result = preprocessOnsetPcm(input, 48000);
    expect(result.analysisSampleRate).toBe(24000);
    expect(result.samples.length).toBe(24000);
    expect(mapAnalysisSampleToSource(100, result.analysisToSourceRatio, input.length)).toBe(200);
  });
});
