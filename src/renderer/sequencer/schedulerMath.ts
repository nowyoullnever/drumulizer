import {
  MAX_ACTIVE_SEQUENCER_VOICES,
  SEQUENCER_BEATS_PER_BAR,
  SEQUENCER_STEPS_PER_BAR,
  SEQUENCER_STEPS_PER_BEAT,
} from '../../shared/constants/sequencer';
import type { SliceRegion } from '../slice/types';
import { buildEventAudioPlan } from './eventAudio';
import { isLaneAudible, totalPatternSteps } from './patternModel';
import type { ScheduledSequencerEvent, SequencerPattern } from './types';

export const stepDurationSeconds = (bpm: number): number =>
  60 / Math.max(1, bpm) / SEQUENCER_STEPS_PER_BEAT;
export const barDurationSeconds = (bpm: number): number =>
  stepDurationSeconds(bpm) * SEQUENCER_STEPS_PER_BAR;
export const patternDurationSeconds = (pattern: SequencerPattern): number =>
  barDurationSeconds(pattern.bpm) * pattern.bars;

export const stepTimeSeconds = (
  pattern: SequencerPattern,
  stepIndex: number,
  loopIndex = 0,
): number =>
  loopIndex * patternDurationSeconds(pattern) +
  Math.max(0, stepIndex) * stepDurationSeconds(pattern.bpm);

export const stepFromPosition = (pattern: SequencerPattern, positionSeconds: number): number => {
  const step = Math.floor(Math.max(0, positionSeconds) / stepDurationSeconds(pattern.bpm));
  return Math.max(0, Math.min(totalPatternSteps(pattern) - 1, step));
};

export const beatsFromPosition = (bpm: number, positionSeconds: number): number =>
  (Math.max(0, positionSeconds) / 60) * bpm;

export interface ScheduleWindowInput {
  pattern: SequencerPattern;
  slices: SliceRegion[];
  windowStartSeconds: number;
  windowEndSeconds: number;
  transportOriginSeconds: number;
  scheduledKeys: Set<string>;
  masterGain: number;
  maxVoices?: number;
}

export interface ScheduleWindowResult {
  scheduled: ScheduledSequencerEvent[];
  invalidSkipped: number;
  mutedSkipped: number;
  duplicateSkipped: number;
  voiceLimitSkipped: number;
}

export const scheduleWindow = (input: ScheduleWindowInput): ScheduleWindowResult => {
  const patternDuration = patternDurationSeconds(input.pattern);
  const slicesById = new Map(input.slices.map((slice) => [slice.id, slice]));
  const scheduled: ScheduledSequencerEvent[] = [];
  let invalidSkipped = 0;
  let mutedSkipped = 0;
  let duplicateSkipped = 0;
  let voiceLimitSkipped = 0;
  if (patternDuration <= 0 || input.windowEndSeconds <= input.windowStartSeconds) {
    return { scheduled, invalidSkipped, mutedSkipped, duplicateSkipped, voiceLimitSkipped };
  }

  const firstLoop = Math.max(0, Math.floor(input.windowStartSeconds / patternDuration) - 1);
  const lastLoop = Math.max(
    firstLoop,
    Math.floor(Math.max(0, input.windowEndSeconds - 0.000001) / patternDuration),
  );
  const maxVoices = input.maxVoices ?? MAX_ACTIVE_SEQUENCER_VOICES;
  for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex += 1) {
    if (!input.pattern.loopEnabled && loopIndex > 0) break;
    for (const event of input.pattern.events) {
      if (!isLaneAudible(input.pattern.lanes, event.laneId)) {
        mutedSkipped += 1;
        continue;
      }
      const eventTime = stepTimeSeconds(input.pattern, event.stepIndex, loopIndex);
      if (eventTime < input.windowStartSeconds || eventTime >= input.windowEndSeconds) continue;
      const key = `${loopIndex}:${event.id}:${event.stepIndex}`;
      if (input.scheduledKeys.has(key)) {
        duplicateSkipped += 1;
        continue;
      }
      const slice = slicesById.get(event.sliceId);
      if (!slice) {
        invalidSkipped += 1;
        input.scheduledKeys.add(key);
        continue;
      }
      if (scheduled.length >= maxVoices) {
        voiceLimitSkipped += 1;
        continue;
      }
      const plan = buildEventAudioPlan({
        event,
        slice,
        lane: input.pattern.lanes[event.laneId],
        masterGain: input.masterGain,
      });
      input.scheduledKeys.add(key);
      scheduled.push({
        eventId: event.id,
        laneId: event.laneId,
        stepIndex: event.stepIndex,
        loopIndex,
        audioTimeSeconds: input.transportOriginSeconds + eventTime,
        offsetSeconds: plan.offsetSeconds,
        durationSeconds: plan.durationSeconds,
        playbackRate: plan.playbackRate,
        eventGain: plan.eventGain,
        laneGain: plan.laneGain,
        pan: plan.pan,
        fadeSeconds: plan.fadeSeconds,
      });
    }
  }

  scheduled.sort(
    (left, right) =>
      left.audioTimeSeconds - right.audioTimeSeconds ||
      left.stepIndex - right.stepIndex ||
      left.laneId.localeCompare(right.laneId),
  );
  return { scheduled, invalidSkipped, mutedSkipped, duplicateSkipped, voiceLimitSkipped };
};

export const expectedStepsPerLoop = (): number =>
  SEQUENCER_BEATS_PER_BAR * SEQUENCER_STEPS_PER_BEAT;
