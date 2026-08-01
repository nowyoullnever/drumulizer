import {
  MAX_REVERSE_BUFFER_CACHE_BYTES,
  MAX_REVERSE_BUFFER_CACHE_ENTRIES,
} from '../../shared/constants/sequencer';
import type { SliceRegion } from '../slice/types';

interface ReverseBufferEntry {
  key: string;
  buffer: AudioBuffer;
  bytes: number;
  lastUsed: number;
}

export class ReverseBufferCache {
  private entries = new Map<string, ReverseBufferEntry>();
  private tick = 0;
  private bytes = 0;

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  invalidateSlice(sliceId: string): void {
    for (const [key, entry] of this.entries) {
      if (!key.includes(`:${sliceId}:`)) continue;
      this.entries.delete(key);
      this.bytes -= entry.bytes;
    }
  }

  async getOrCreate(input: {
    context: AudioContext;
    sourceId: string;
    source: AudioBuffer;
    slice: SliceRegion;
  }): Promise<AudioBuffer> {
    const key = this.cacheKey(input.sourceId, input.source, input.slice);
    const cached = this.entries.get(key);
    if (cached) {
      cached.lastUsed = ++this.tick;
      return cached.buffer;
    }

    const startSample = Math.max(0, Math.min(input.source.length, input.slice.startSample));
    const endSample = Math.max(
      startSample + 1,
      Math.min(input.source.length, input.slice.endSample),
    );
    const length = endSample - startSample;
    const buffer = input.context.createBuffer(
      input.source.numberOfChannels,
      length,
      input.source.sampleRate,
    );
    for (let channel = 0; channel < input.source.numberOfChannels; channel += 1) {
      const source = input.source.getChannelData(channel);
      const target = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        target[index] = source[endSample - index - 1] ?? 0;
      }
    }

    const bytes = length * input.source.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    this.entries.set(key, { key, buffer, bytes, lastUsed: ++this.tick });
    this.bytes += bytes;
    this.evict();
    return buffer;
  }

  private cacheKey(sourceId: string, source: AudioBuffer, slice: SliceRegion): string {
    return [
      sourceId,
      slice.id,
      slice.startSample,
      slice.endSample,
      source.numberOfChannels,
      source.sampleRate,
    ].join(':');
  }

  private evict(): void {
    while (
      this.entries.size > MAX_REVERSE_BUFFER_CACHE_ENTRIES ||
      this.bytes > MAX_REVERSE_BUFFER_CACHE_BYTES
    ) {
      const oldest = [...this.entries.values()].sort(
        (left, right) => left.lastUsed - right.lastUsed,
      )[0];
      if (!oldest) return;
      this.entries.delete(oldest.key);
      this.bytes -= oldest.bytes;
    }
  }
}

export const reverseOffsetForSliceBuffer = (input: {
  slice: SliceRegion;
  sourceOffsetSeconds: number;
  durationSeconds: number;
}): number => {
  const relativeEnd = input.sourceOffsetSeconds + input.durationSeconds - input.slice.startSeconds;
  return Math.max(0, input.slice.durationSeconds - relativeEnd);
};
