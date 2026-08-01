import { describe, expect, it } from 'vitest';
import {
  createDefaultPattern,
  paintEvent,
  setPatternSwing,
  updateEvent,
} from '../sequencer/patternModel';
import {
  combinedTimingOffsetSteps,
  dynamicScheduleAheadSeconds,
  dynamicTransportStartLeadSeconds,
  eventTimeSeconds,
  microtimingMilliseconds,
  stepDurationSeconds,
  swingOffsetSteps,
} from '../sequencer/schedulerMath';

describe('swing and microtiming', () => {
  it('delays odd steps, clamps combined timing, and scales milliseconds by BPM', () => {
    let pattern = setPatternSwing(createDefaultPattern(), 100);
    pattern = paintEvent({ pattern, laneId: 'high', stepIndex: 1, sliceId: 'slice-a' }).pattern;
    const event = updateEvent(pattern, pattern.events[0].id, {
      transform: { ...pattern.events[0].transform, timingOffsetSteps: 0.3 },
    }).pattern.events[0];
    expect(swingOffsetSteps(pattern, 0)).toBe(0);
    expect(swingOffsetSteps(pattern, 1)).toBeCloseTo(1 / 3);
    expect(combinedTimingOffsetSteps(pattern, event)).toBe(0.45);
    expect(microtimingMilliseconds(pattern, event)).toBeCloseTo(
      0.3 * stepDurationSeconds(pattern.bpm) * 1000,
    );
    expect(eventTimeSeconds(pattern, event, 0)).toBeCloseTo(
      stepDurationSeconds(pattern.bpm) * 1.45,
    );
  });

  it('computes dynamic lead and schedule horizon for negative timing', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'texture', stepIndex: 0, sliceId: 'slice-a' }).pattern;
    pattern = updateEvent(pattern, pattern.events[0].id, {
      transform: { ...pattern.events[0].transform, timingOffsetSteps: -0.45 },
    }).pattern;
    expect(dynamicTransportStartLeadSeconds(pattern)).toBeGreaterThan(0.04);
    expect(dynamicScheduleAheadSeconds(pattern)).toBeGreaterThanOrEqual(0.12);
  });
});
