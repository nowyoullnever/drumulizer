import { describe, expect, it } from 'vitest';
import { exportPatternWavs } from '../export/offlineRender';
import { createDefaultPattern, paintEvent } from '../sequencer/patternModel';
import type { SliceRegion } from '../slice/types';

const source = {
  sampleRate: 48000,
  length: 48000,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(48000).fill(0.1),
} as unknown as AudioBuffer;

const slice: SliceRegion = {
  id: 'slice',
  index: 0,
  startSample: 0,
  endSample: 12000,
  durationSamples: 12000,
  startSeconds: 0,
  endSeconds: 0.25,
  durationSeconds: 0.25,
  leftBoundaryId: 'start',
  rightBoundaryId: 'end',
};

describe('deterministic export evaluation', () => {
  it('reports release guardrail diagnostics for synthetic pattern export', () => {
    const pattern = paintEvent({
      pattern: createDefaultPattern(),
      laneId: 'low',
      stepIndex: 0,
      sliceId: slice.id,
    }).pattern;
    const files = exportPatternWavs({
      baseName: 'eval',
      pattern,
      slices: [slice],
      sourceBuffer: source,
      outputMode: 'mix',
      options: {
        mode: 'seamless-loop',
        loops: 1,
        sampleRate: 48000,
        bitDepth: 16,
        normalize: true,
        includeTail: false,
        seed: 'eval-seed',
        masterGain: 1,
      },
    });
    expect(files[0].diagnostics.duplicateVoiceKeys).toBe(0);
    expect(files[0].diagnostics.invalidAudioTimes).toBe(0);
    expect(files[0].diagnostics.durationSeconds).toBeGreaterThan(0);
  });
});
