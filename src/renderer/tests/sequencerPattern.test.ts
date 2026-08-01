import { describe, expect, it } from 'vitest';
import { SEQUENCER_STEPS_PER_BAR } from '../../shared/constants/sequencer';
import {
  clearLane,
  clearPattern,
  createDefaultPattern,
  DEFAULT_EVENT_TRANSFORM,
  normalizeEventTransform,
  paintEvent,
  reconcilePatternSlices,
  setLaneState,
  setPatternBars,
  setPatternBpm,
  setPatternSwing,
  updateEvent,
} from '../sequencer/patternModel';
import type { SliceRegion } from '../slice/types';

const slice = (id: string): SliceRegion => ({
  id,
  index: 0,
  startSample: 0,
  endSample: 2400,
  durationSamples: 2400,
  startSeconds: 0,
  endSeconds: 0.1,
  durationSeconds: 0.1,
  leftBoundaryId: 'source-start',
  rightBoundaryId: 'source-end',
});

describe('sequencer pattern model', () => {
  it('adds, replaces, removes, and clamps events deterministically', () => {
    const initial = createDefaultPattern();
    const added = paintEvent({ pattern: initial, laneId: 'low', stepIndex: 0, sliceId: 'a' });
    expect(added.pattern.events).toHaveLength(1);
    expect(added.pattern.events[0].sliceId).toBe('a');

    const replaced = paintEvent({
      pattern: added.pattern,
      laneId: 'low',
      stepIndex: 0,
      sliceId: 'b',
    });
    expect(replaced.pattern.events).toHaveLength(1);
    expect(replaced.pattern.events[0].id).toBe(added.pattern.events[0].id);
    expect(replaced.pattern.events[0].sliceId).toBe('b');

    const updated = updateEvent(replaced.pattern, replaced.pattern.events[0].id, {
      velocity: 2,
      pan: -2,
      pitchSemitones: 99,
    });
    expect(updated.pattern.events[0]).toMatchObject({
      velocity: 1,
      pan: -1,
      pitchSemitones: 24,
    });
  });

  it('supports lane clear, pattern clear, bar reduction, and reconciliation', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'low', stepIndex: 0, sliceId: 'keep' }).pattern;
    pattern = paintEvent({
      pattern,
      laneId: 'mid',
      stepIndex: SEQUENCER_STEPS_PER_BAR + 1,
      sliceId: 'drop',
    }).pattern;
    expect(clearLane(pattern, 'low', pattern.events[0].id).removedCount).toBe(1);
    expect(clearPattern(pattern).removedCount).toBe(2);
    expect(setPatternBars(pattern, 1, null).removedCount).toBe(1);
    expect(
      reconcilePatternSlices({ pattern, slices: [slice('keep')], selectedEventId: null })
        .removedCount,
    ).toBe(1);
  });

  it('clamps BPM and applies live lane mute solo volume state', () => {
    const pattern = setLaneState(setPatternBpm(createDefaultPattern(), 999), 'high', {
      muted: true,
      soloed: true,
      gainDb: 99,
    });
    expect(pattern.bpm).toBe(240);
    expect(pattern.lanes.high).toMatchObject({ muted: true, soloed: true, gainDb: 6 });
  });

  it('normalizes legacy and non-finite transformation state safely', () => {
    const pattern = paintEvent({
      pattern: createDefaultPattern(),
      laneId: 'low',
      stepIndex: 0,
      sliceId: 'a',
    }).pattern;
    expect(pattern.events[0].transform).toEqual(DEFAULT_EVENT_TRANSFORM);

    const normalized = normalizeEventTransform({
      probability: Number.NaN,
      timingOffsetSteps: -99,
      ratchetCount: 99,
      ratchetDecay: 99,
      reverse: true,
      playbackMode: 'granular',
      grainSizeMs: 999,
      grainCount: 99,
      grainPosition: 99,
      grainSpray: 99,
      grainPitchJitterSemitones: 99,
    });
    expect(normalized).toMatchObject({
      probability: 1,
      timingOffsetSteps: -0.45,
      ratchetCount: 4,
      ratchetDecay: 1,
      reverse: true,
      playbackMode: 'granular',
      grainSizeMs: 120,
      grainCount: 8,
      grainPosition: 1,
      grainSpray: 1,
      grainPitchJitterSemitones: 12,
    });
    expect(setPatternSwing(createDefaultPattern(), 999).swing).toBe(100);
  });
});
