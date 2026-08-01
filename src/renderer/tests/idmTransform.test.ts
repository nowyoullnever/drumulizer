import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent, updateEvent } from '../sequencer/patternModel';
import {
  applyIDMTransform,
  createDefaultIDMTransformMutationState,
  createDefaultIDMTransformSettings,
  resetIDMTransforms,
} from '../sequencer/transform/idmTransform';

const patternWithEvents = () => {
  let pattern = createDefaultPattern();
  pattern = paintEvent({ pattern, laneId: 'low', stepIndex: 0, sliceId: 'slice-a' }).pattern;
  pattern = paintEvent({ pattern, laneId: 'high', stepIndex: 4, sliceId: 'slice-a' }).pattern;
  return pattern;
};

describe('IDM transform engine', () => {
  it('is deterministic and does not change structure or slice assignments', () => {
    const pattern = patternWithEvents();
    const settings = {
      ...createDefaultIDMTransformSettings(),
      seed: 'idm',
      intensity: 80,
      mode: 'replace-unlocked' as const,
    };
    const first = applyIDMTransform({
      pattern,
      selectedEventId: null,
      settings,
      mutationState: createDefaultIDMTransformMutationState(settings.seed),
      action: 'apply',
    });
    const second = applyIDMTransform({
      pattern,
      selectedEventId: null,
      settings,
      mutationState: createDefaultIDMTransformMutationState(settings.seed),
      action: 'apply',
    });
    expect(first.pattern.events).toEqual(second.pattern.events);
    expect(
      first.pattern.events.map(({ laneId, stepIndex, sliceId }) => ({
        laneId,
        stepIndex,
        sliceId,
      })),
    ).toEqual(
      pattern.events.map(({ laneId, stepIndex, sliceId }) => ({ laneId, stepIndex, sliceId })),
    );
    expect(first.summary.changed).toBeGreaterThan(0);
  });

  it('preserves protected manual events and resets unlocked transforms', () => {
    let pattern = patternWithEvents();
    pattern = updateEvent(pattern, pattern.events[0].id, {
      transform: { ...pattern.events[0].transform, reverse: true },
      locked: true,
    }).pattern;
    const settings = { ...createDefaultIDMTransformSettings(), intensity: 0 };
    const reset = resetIDMTransforms({ pattern, selectedEventId: null, settings });
    expect(reset.pattern.events[0].transform.reverse).toBe(true);
    expect(reset.summary.preserved).toBe(2);
  });
});
