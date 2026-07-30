import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent } from '../sequencer/patternModel';
import { evaluateScheduler } from '../sequencer/schedulerEvaluation';
import {
  barDurationSeconds,
  patternDurationSeconds,
  scheduleWindow,
  stepDurationSeconds,
} from '../sequencer/schedulerMath';
import {
  buildEventAudioPlan,
  eventFadeSeconds,
  pitchToPlaybackRate,
  velocityToGain,
} from '../sequencer/eventAudio';
import type { SliceRegion } from '../slice/types';

const slices: SliceRegion[] = [
  {
    id: 'slice-a',
    index: 0,
    startSample: 0,
    endSample: 2400,
    durationSamples: 2400,
    startSeconds: 0,
    endSeconds: 0.1,
    durationSeconds: 0.1,
    leftBoundaryId: 'source-start',
    rightBoundaryId: 'source-end',
  },
];

describe('sequencer scheduler math', () => {
  it('calculates BPM, bar, and pattern durations', () => {
    const pattern = createDefaultPattern();
    expect(stepDurationSeconds(120)).toBeCloseTo(0.125);
    expect(barDurationSeconds(120)).toBeCloseTo(2);
    expect(patternDurationSeconds(pattern)).toBeCloseTo(4);
  });

  it('schedules multiple lane events once through loop boundaries without drift', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'low', stepIndex: 0, sliceId: 'slice-a' }).pattern;
    pattern = paintEvent({ pattern, laneId: 'mid', stepIndex: 0, sliceId: 'slice-a' }).pattern;
    pattern = paintEvent({ pattern, laneId: 'high', stepIndex: 31, sliceId: 'slice-a' }).pattern;
    const keys = new Set<string>();
    const first = scheduleWindow({
      pattern,
      slices,
      windowStartSeconds: 0,
      windowEndSeconds: patternDurationSeconds(pattern) * 2,
      transportOriginSeconds: 10,
      scheduledKeys: keys,
      masterGain: 1,
    });
    const second = scheduleWindow({
      pattern,
      slices,
      windowStartSeconds: 0,
      windowEndSeconds: patternDurationSeconds(pattern) * 2,
      transportOriginSeconds: 10,
      scheduledKeys: keys,
      masterGain: 1,
    });
    expect(first.scheduled).toHaveLength(6);
    expect(second.scheduled).toHaveLength(0);
    expect(second.duplicateSkipped).toBeGreaterThan(0);
    expect(first.scheduled[0].audioTimeSeconds).toBeCloseTo(10);
  });

  it('evaluates 100 loops without cumulative calculated deviation', () => {
    const pattern = paintEvent({
      pattern: createDefaultPattern(),
      laneId: 'texture',
      stepIndex: 0,
      sliceId: 'slice-a',
    }).pattern;
    const result = evaluateScheduler({ pattern, slices, loopCount: 100 });
    expect(result.expectedEventCount).toBe(100);
    expect(result.scheduledEventCount).toBe(100);
    expect(result.duplicateCount).toBe(0);
    expect(result.missedCount).toBe(0);
    expect(result.maxCalculatedDeviationSeconds).toBe(0);
  });

  it('skips invalid references and maps audio parameters', () => {
    const pattern = paintEvent({
      pattern: createDefaultPattern(),
      laneId: 'low',
      stepIndex: 0,
      sliceId: 'missing',
    }).pattern;
    const result = evaluateScheduler({ pattern, slices, loopCount: 2 });
    expect(result.invalidEventsSkipped).toBeGreaterThan(0);
    expect(velocityToGain(0.5)).toBeCloseTo(0.25);
    expect(pitchToPlaybackRate(12)).toBeCloseTo(2);
    expect(eventFadeSeconds(0.004)).toBeCloseTo(0.001);
    expect(
      buildEventAudioPlan({
        event: {
          ...pattern.events[0],
          sliceId: 'slice-a',
          velocity: 0.5,
          pan: 1,
          pitchSemitones: -12,
        },
        slice: slices[0],
        lane: createDefaultPattern().lanes.low,
        masterGain: 0.8,
      }),
    ).toMatchObject({ eventGain: 0.25, pan: 1, playbackRate: 0.5 });
  });
});
