import { describe, expect, it } from 'vitest';
import { robustLocalNormalize } from '../audio/onset/adaptiveThreshold';
import { calibrateConfidence, detectOnsets } from '../audio/onset/detectOnsets';
import { clampOnsetSettings } from '../audio/onset/onsetTypes';
import { enforceMinimumFrameGap } from '../audio/onset/peakPicking';
import { refineOnsetSample } from '../audio/onset/refineOnsets';
import { applyDetectedCandidates } from '../slice/sliceModel';
import type { SliceMarker } from '../slice/types';

const sampleRate = 24000;

const impulses = (positions: number[], amplitudes?: number[]): Float32Array => {
  const data = new Float32Array(sampleRate);
  positions.forEach((position, index) => {
    data[position] = amplitudes?.[index] ?? 1;
    data[position + 1] = -0.6 * (amplitudes?.[index] ?? 1);
  });
  return data;
};

const detect = (data: Float32Array, sensitivity = 75, minimumGapMs = 45) =>
  detectOnsets({
    requestId: 'test',
    monoData: data,
    originalSampleRate: sampleRate,
    settings: { sensitivity, minimumGapMs },
  });

describe('onset detection candidates', () => {
  it('detects isolated and repeated impulses while silence stays empty', () => {
    expect(detect(impulses([6000])).candidates.length).toBeGreaterThanOrEqual(1);
    expect(detect(impulses([3000, 9000, 15000])).candidates.length).toBeGreaterThanOrEqual(2);
    const silent = detect(new Float32Array(sampleRate));
    expect(silent.candidates).toHaveLength(0);
    expect(silent.reason).toBe('SILENT_SOURCE');
  });

  it('collapses close impulses to the stronger one and keeps farther impulses', () => {
    const close = detect(impulses([6000, 6500], [0.4, 1]), 100, 45);
    expect(close.candidates).toHaveLength(1);
    expect(close.candidates[0].sampleIndex).toBeGreaterThan(5600);
    expect(
      enforceMinimumFrameGap(
        [
          { frameIndex: 10, score: 1, prominence: 0.5 },
          { frameIndex: 12, score: 3, prominence: 1 },
        ],
        45,
        sampleRate,
        128,
      ),
    ).toEqual([{ frameIndex: 12, score: 3, prominence: 1 }]);

    const far = detect(impulses([3000, 9000]), 80, 45);
    expect(far.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('does not over-detect sustained or ramped tones', () => {
    const tone = Float32Array.from(
      { length: sampleRate },
      (_, index) => Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.2,
    );
    expect(detect(tone, 70).candidates.length).toBeLessThanOrEqual(2);

    const ramp = Float32Array.from(
      { length: sampleRate },
      (_, index) => Math.sin((2 * Math.PI * 220 * index) / sampleRate) * (index / sampleRate) * 0.4,
    );
    expect(detect(ramp, 70).candidates.length).toBeLessThanOrEqual(4);
  });

  it('detects noisy, low-frequency, and high-frequency attacks with finite scores', () => {
    const noisy = impulses([8000]);
    for (let index = 8000; index < 8100; index += 1) noisy[index] += index % 2 ? 0.5 : -0.5;
    const low = Float32Array.from({ length: sampleRate }, (_, index) =>
      index > 5000 && index < 5600 ? Math.sin((2 * Math.PI * 80 * index) / sampleRate) * 0.8 : 0,
    );
    const high = impulses([7000]);
    expect(detect(noisy, 80).candidates.length).toBeGreaterThanOrEqual(1);
    expect(detect(low, 100).candidates.length).toBeGreaterThanOrEqual(1);
    expect(detect(high, 80).candidates.every((candidate) => Number.isFinite(candidate.score))).toBe(
      true,
    );
  });

  it('keeps sensitivity monotonic and clamps settings', () => {
    const data = impulses([3000, 9000, 15000, 21000], [0.3, 0.45, 0.7, 1]);
    const low = detect(data, 5).candidates.length;
    const high = detect(data, 100).candidates.length;
    expect(high).toBeGreaterThanOrEqual(low);
    expect(clampOnsetSettings({ sensitivity: 200, minimumGapMs: 1 })).toEqual({
      sensitivity: 100,
      minimumGapMs: 20,
    });
  });

  it('normalizes blockwise novelty without non-finite output or severe block seams', () => {
    const values = Float32Array.from({ length: 260 }, (_, index) =>
      index === 127 || index === 128 ? 4 : Math.sin(index / 11) * 0.1 + (index > 128 ? 0.2 : 0),
    );
    values[20] = Number.NaN;
    values[21] = Number.POSITIVE_INFINITY;
    const normalized = robustLocalNormalize(values, sampleRate, 128);
    expect(normalized).toHaveLength(values.length);
    expect([...normalized].every(Number.isFinite)).toBe(true);
    expect(Math.abs(normalized[127] - normalized[128])).toBeLessThan(10);
  });

  it('calibrates confidence with bounded monotonic evidence', () => {
    const weak = calibrateConfidence({
      score: 1.2,
      threshold: 1,
      prominence: 0.4,
      attackEvidence: 0.5,
      supportCount: 1,
    });
    const strong = calibrateConfidence({
      score: 8,
      threshold: 1,
      prominence: 6,
      attackEvidence: 6,
      supportCount: 4,
    });
    expect(weak).toBeGreaterThanOrEqual(0);
    expect(weak).toBeLessThan(strong);
    expect(strong).toBeLessThanOrEqual(1);
  });

  it('refines toward attack, keeps bounds, and supports replace/merge integration', () => {
    const data = impulses([6000]);
    expect(refineOnsetSample(data, sampleRate, 6100)).toBeGreaterThan(5900);
    expect(refineOnsetSample(data, sampleRate, 1)).toBeGreaterThanOrEqual(1);

    const candidates = detect(data, 100).candidates;
    const manual: SliceMarker = { id: 'manual', sampleIndex: 12000, origin: 'manual' };
    const replace = applyDetectedCandidates({
      markers: [manual],
      candidates,
      mode: 'replace',
      sourceLengthSamples: data.length,
      sampleRate,
    });
    expect(replace.markers.every((marker) => marker.origin === 'detected')).toBe(true);

    const merge = applyDetectedCandidates({
      markers: [manual],
      candidates: [{ ...candidates[0], sampleIndex: 12002 }],
      mode: 'merge',
      sourceLengthSamples: data.length,
      sampleRate,
    });
    expect(merge.markers).toHaveLength(1);
    expect(merge.summary.candidatesSkipped).toBe(1);
  });
});
