import { describe, expect, it, vi } from 'vitest';
import { ReverseBufferCache, reverseOffsetForSliceBuffer } from '../sequencer/reverseBufferCache';
import type { SliceRegion } from '../slice/types';

class FakeAudioBuffer {
  numberOfChannels = 2;
  sampleRate = 4;
  length = 4;
  channels = [new Float32Array([1, 2, 3, 4]), new Float32Array([5, 6, 7, 8])];
  getChannelData(channel: number) {
    return this.channels[channel];
  }
}

const slice: SliceRegion = {
  id: 'slice-a',
  index: 0,
  startSample: 1,
  endSample: 4,
  durationSamples: 3,
  startSeconds: 0.25,
  endSeconds: 1,
  durationSeconds: 0.75,
  leftBoundaryId: 'source-start',
  rightBoundaryId: 'source-end',
};

describe('reverse buffer cache', () => {
  it('reverses only the slice range and preserves channels', async () => {
    const cache = new ReverseBufferCache();
    const created = {
      numberOfChannels: 2,
      sampleRate: 4,
      length: 3,
      channels: [new Float32Array(3), new Float32Array(3)],
      getChannelData(channel: number) {
        return this.channels[channel];
      },
    };
    const context = { createBuffer: vi.fn(() => created) };
    const buffer = await cache.getOrCreate({
      context: context as unknown as AudioContext,
      sourceId: 'source',
      source: new FakeAudioBuffer() as unknown as AudioBuffer,
      slice,
    });
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(Array.from(buffer.getChannelData(0))).toEqual([4, 3, 2]);
    expect(Array.from(buffer.getChannelData(1))).toEqual([8, 7, 6]);
    await cache.getOrCreate({
      context: context as unknown as AudioContext,
      sourceId: 'source',
      source: new FakeAudioBuffer() as unknown as AudioBuffer,
      slice,
    });
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(
      reverseOffsetForSliceBuffer({ slice, sourceOffsetSeconds: 0.25, durationSeconds: 0.25 }),
    ).toBeCloseTo(0.5);
  });
});
