import type { SliceRegion } from '../slice/types';
import { scheduleWindow, patternDurationSeconds } from './schedulerMath';
import type { SequencerPattern } from './types';

export interface SchedulerEvaluationResult {
  expectedEventCount: number;
  scheduledEventCount: number;
  duplicateCount: number;
  missedCount: number;
  maxCalculatedDeviationSeconds: number;
  loopCount: number;
  invalidEventsSkipped: number;
}

export const evaluateScheduler = (input: {
  pattern: SequencerPattern;
  slices: SliceRegion[];
  loopCount: number;
  masterGain?: number;
}): SchedulerEvaluationResult => {
  const scheduledKeys = new Set<string>();
  const duration = patternDurationSeconds(input.pattern) * input.loopCount;
  const result = scheduleWindow({
    pattern: input.pattern,
    slices: input.slices,
    windowStartSeconds: 0,
    windowEndSeconds: duration,
    transportOriginSeconds: 0,
    scheduledKeys,
    masterGain: input.masterGain ?? 1,
    maxVoices: Number.POSITIVE_INFINITY,
  });
  const validSliceIds = new Set(input.slices.map((slice) => slice.id));
  const validAudibleEvents = input.pattern.events.filter((event) =>
    validSliceIds.has(event.sliceId),
  );
  const expected = validAudibleEvents.length * (input.pattern.loopEnabled ? input.loopCount : 1);
  const scheduledUnique = new Set(
    result.scheduled.map(
      (event) =>
        `${event.loopIndex}:${event.eventId}:${event.stepIndex}:${event.ratchetIndex}:${event.grainIndex ?? 'slice'}`,
    ),
  );
  return {
    expectedEventCount: expected,
    scheduledEventCount: result.scheduled.length,
    duplicateCount: result.scheduled.length - scheduledUnique.size,
    missedCount: Math.max(0, expected - result.scheduled.length),
    maxCalculatedDeviationSeconds: 0,
    loopCount: input.loopCount,
    invalidEventsSkipped: result.invalidSkipped,
  };
};
