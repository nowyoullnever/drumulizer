import { describe, expect, it } from 'vitest';
import { createAnalysisMonoData } from '../audio/mixdown';
import { buildChannelPeaks, buildPeakLevel } from '../audio/waveformPeaks';

const makeBuffer = (channels: Float32Array[]): AudioBuffer =>
  ({
    length: channels[0]?.length ?? 0,
    numberOfChannels: channels.length,
    getChannelData: (index: number) => channels[index],
  }) as AudioBuffer;

describe('mono mixdown', () => {
  it('keeps mono unchanged and averages stereo or multichannel input', () => {
    const mono = Array.from(createAnalysisMonoData(makeBuffer([new Float32Array([0.2, -0.4])])));
    expect(mono[0]).toBeCloseTo(0.2);
    expect(mono[1]).toBeCloseTo(-0.4);
    expect(
      Array.from(
        createAnalysisMonoData(makeBuffer([new Float32Array([1, -1]), new Float32Array([-1, 1])])),
      ),
    ).toEqual([0, 0]);
    expect(
      Array.from(
        createAnalysisMonoData(
          makeBuffer([
            new Float32Array([1, 1]),
            new Float32Array([0, 0]),
            new Float32Array([-1, 2]),
          ]),
        ),
      ),
    ).toEqual([0, 1]);
  });
});

describe('waveform peaks', () => {
  it('generates deterministic min/max peaks without NaN', () => {
    const level = buildPeakLevel(new Float32Array([0, 0.5, -0.25, 1, -1, 0.1]), 3);
    expect(Array.from(level.minimums)).toEqual([0, -0.25, -1]);
    expect(level.maximums[0]).toBeCloseTo(0.5);
    expect(level.maximums[1]).toBeCloseTo(1);
    expect(level.maximums[2]).toBeCloseTo(0.1);
    expect(Array.from(level.maximums).every(Number.isFinite)).toBe(true);
  });

  it('handles silent, short, and stereo-separated channel peak data', () => {
    expect(Array.from(buildPeakLevel(new Float32Array([0, 0]), 4).maximums)).toEqual([0, 0]);
    expect(buildPeakLevel(new Float32Array([0.75]), 4).maximums[0]).toBe(0.75);
    const left = buildChannelPeaks(new Float32Array([1, -1]), 0);
    const right = buildChannelPeaks(new Float32Array([0.25, -0.25]), 1);
    expect(left.channelIndex).toBe(0);
    expect(right.channelIndex).toBe(1);
  });
});
