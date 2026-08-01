import { describe, expect, it } from 'vitest';
import { exportPatternWavs } from '../export/offlineRender';
import { createDefaultPattern, paintEvent, updateEvent } from '../sequencer/patternModel';
import type { SliceRegion } from '../slice/types';

const fakeBuffer = (): AudioBuffer =>
  ({
    sampleRate: 48000,
    length: 12000,
    duration: 1,
    numberOfChannels: 2,
    getChannelData: (channel: number) => {
      const data = new Float32Array(12000);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.sin(index / (channel ? 13 : 11)) * 0.2;
      }
      return data;
    },
  }) as unknown as AudioBuffer;

const slices: SliceRegion[] = [
  {
    id: 'slice-1',
    index: 0,
    startSample: 0,
    endSample: 6000,
    durationSamples: 6000,
    startSeconds: 0,
    endSeconds: 0.125,
    durationSeconds: 0.125,
    leftBoundaryId: 'start',
    rightBoundaryId: 'end',
  },
];

describe('offline pattern rendering', () => {
  it('exports deterministic mix and four stems with transformed events', () => {
    let pattern = paintEvent({
      pattern: createDefaultPattern(),
      laneId: 'low',
      stepIndex: 0,
      sliceId: slices[0].id,
    }).pattern;
    const event = pattern.events[0];
    pattern = updateEvent(pattern, event.id, {
      transform: {
        ...event.transform,
        probability: 1,
        ratchetCount: 2,
        reverse: true,
        playbackMode: 'granular',
        grainCount: 3,
      },
    }).pattern;
    const files = exportPatternWavs({
      baseName: 'synthetic',
      pattern,
      slices,
      sourceBuffer: fakeBuffer(),
      outputMode: 'mix-and-stems',
      options: {
        mode: 'performance',
        loops: 1,
        sampleRate: 8000,
        bitDepth: 16,
        normalize: true,
        includeTail: true,
        seed: 'render-seed',
        masterGain: 0.8,
      },
    });
    expect(files).toHaveLength(5);
    expect(files[0].diagnostics.duplicateVoiceKeys).toBe(0);
    expect([...new Uint8Array(files[0].bytes)]).toEqual([
      ...new Uint8Array(
        exportPatternWavs({
          baseName: 'synthetic',
          pattern,
          slices,
          sourceBuffer: fakeBuffer(),
          outputMode: 'mix-and-stems',
          options: {
            mode: 'performance',
            loops: 1,
            sampleRate: 8000,
            bitDepth: 16,
            normalize: true,
            includeTail: true,
            seed: 'render-seed',
            masterGain: 0.8,
          },
        })[0].bytes,
      ),
    ]);
  });
});
