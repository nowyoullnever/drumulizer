import { describe, expect, it } from 'vitest';
import {
  calculatePauseOffset,
  calculatePlaybackPosition,
  clampSeek,
  isEndOfFile,
} from '../audio/playbackMath';
import { formatDuration, formatSeconds } from '../audio/time';

describe('time utilities', () => {
  it('formats seconds and durations safely', () => {
    expect(formatSeconds(65.4321)).toBe('01:05.432');
    expect(formatDuration(125.2)).toBe('2:05');
    expect(formatSeconds(Number.NaN)).toBe('00:00.000');
    expect(formatDuration(Number.NaN)).toBe('--:--');
  });
});

describe('playback math', () => {
  it('calculates playback, pause, seek, loop, and end positions', () => {
    expect(calculatePlaybackPosition(12, 10, 3, 20, false)).toBe(5);
    expect(calculatePauseOffset(12, 10, 3, 20)).toBe(5);
    expect(clampSeek(-2, 10)).toBe(0);
    expect(clampSeek(12, 10)).toBe(10);
    expect(calculatePlaybackPosition(15, 10, 8, 10, true)).toBe(3);
    expect(isEndOfFile(10, 10)).toBe(true);
  });
});
