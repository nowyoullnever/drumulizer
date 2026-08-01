import { describe, expect, it } from 'vitest';
import { exportSliceWav } from '../export/offlineRender';
import type { SliceRegion } from '../slice/types';

const buffer = {
  sampleRate: 44100,
  length: 44100,
  numberOfChannels: 2,
  getChannelData: () => new Float32Array(44100).fill(0.25),
} as unknown as AudioBuffer;

const slice: SliceRegion = {
  id: 'slice-1',
  index: 0,
  startSample: 100,
  endSample: 1100,
  durationSamples: 1000,
  startSeconds: 100 / 44100,
  endSeconds: 1100 / 44100,
  durationSeconds: 1000 / 44100,
  leftBoundaryId: 'a',
  rightBoundaryId: 'b',
};

describe('slice WAV export', () => {
  it('exports selected slice as deterministic stereo wav', () => {
    const left = exportSliceWav({
      fileName: 'slice-1.wav',
      sourceBuffer: buffer,
      slice,
      bitDepth: 24,
      sampleRate: 44100,
    });
    const right = exportSliceWav({
      fileName: 'slice-1.wav',
      sourceBuffer: buffer,
      slice,
      bitDepth: 24,
      sampleRate: 44100,
    });
    expect(left.fileName).toBe('slice-1.wav');
    expect(new DataView(left.bytes).getUint16(34, true)).toBe(24);
    expect([...new Uint8Array(left.bytes)]).toEqual([...new Uint8Array(right.bytes)]);
  });
});
