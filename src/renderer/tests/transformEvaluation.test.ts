import { describe, expect, it } from 'vitest';
import { createDefaultPattern, paintEvent } from '../sequencer/patternModel';
import { evaluateScheduler } from '../sequencer/schedulerEvaluation';
import {
  applyIDMTransform,
  createDefaultIDMTransformMutationState,
  createDefaultIDMTransformSettings,
} from '../sequencer/transform/idmTransform';
import type { SliceRegion } from '../slice/types';

const slices: SliceRegion[] = [
  {
    id: 'slice-a',
    index: 0,
    startSample: 0,
    endSample: 4800,
    durationSamples: 4800,
    startSeconds: 0,
    endSeconds: 0.1,
    durationSeconds: 0.1,
    leftBoundaryId: 'source-start',
    rightBoundaryId: 'source-end',
  },
];

describe('transform evaluation', () => {
  it('keeps scheduler plans finite and duplicate-free for transformed loops', () => {
    let pattern = createDefaultPattern();
    pattern = paintEvent({ pattern, laneId: 'low', stepIndex: 0, sliceId: 'slice-a' }).pattern;
    pattern = paintEvent({ pattern, laneId: 'texture', stepIndex: 15, sliceId: 'slice-a' }).pattern;
    const settings = { ...createDefaultIDMTransformSettings(), seed: 'eval', intensity: 100 };
    const transformed = applyIDMTransform({
      pattern,
      selectedEventId: null,
      settings,
      mutationState: createDefaultIDMTransformMutationState(settings.seed),
      action: 'apply',
    }).pattern;
    const result = evaluateScheduler({ pattern: transformed, slices, loopCount: 16 });
    expect(result.duplicateCount).toBe(0);
    expect(result.invalidEventsSkipped).toBe(0);
    expect(result.scheduledEventCount).toBeGreaterThan(0);
  });
});
