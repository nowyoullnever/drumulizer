import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent, updateEvent } from '../sequencer/patternModel';
import { scheduleWindow } from '../sequencer/schedulerMath';
import type { SliceRegion } from '../slice/types';

const slices: SliceRegion[] = [
  {
    id: 'slice-a',
    index: 0,
    startSample: 0,
    endSample: 24000,
    durationSamples: 24000,
    startSeconds: 0,
    endSeconds: 0.5,
    durationSeconds: 0.5,
    leftBoundaryId: 'source-start',
    rightBoundaryId: 'source-end',
  },
];

describe('event ratchet', () => {
  it('expands one event into evenly spaced subtriggers with decay', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'high', stepIndex: 0, sliceId: 'slice-a' }).pattern;
    pattern = updateEvent(pattern, pattern.events[0].id, {
      transform: { ...pattern.events[0].transform, ratchetCount: 4, ratchetDecay: 1 },
    }).pattern;
    const result = scheduleWindow({
      pattern,
      slices,
      windowStartSeconds: 0,
      windowEndSeconds: 1,
      transportOriginSeconds: 0,
      scheduledKeys: new Set<string>(),
      masterGain: 1,
      maxVoices: 32,
    });
    expect(result.scheduled).toHaveLength(4);
    expect(result.scheduled[1].audioTimeSeconds - result.scheduled[0].audioTimeSeconds).toBeCloseTo(
      result.scheduled[2].audioTimeSeconds - result.scheduled[1].audioTimeSeconds,
    );
    expect(result.scheduled[3].eventGain).toBeLessThan(result.scheduled[0].eventGain);
  });
});
