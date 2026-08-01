import {
  MAX_ACTIVE_SEQUENCER_VOICES,
  MAX_DYNAMIC_SCHEDULE_AHEAD_SECONDS,
  MAX_EVENT_EXPANDED_VOICES,
  TRANSFORM_TIMING_SAFETY_MARGIN_SECONDS,
  SEQUENCER_BEATS_PER_BAR,
  SEQUENCER_SCHEDULE_AHEAD_SECONDS,
  SEQUENCER_STEPS_PER_BAR,
  SEQUENCER_STEPS_PER_BEAT,
} from '../../shared/constants/sequencer';
import type { SliceRegion } from '../slice/types';
import { buildEventAudioPlan, eventFadeSeconds, pitchToPlaybackRate } from './eventAudio';
import { createPrng } from './generator/prng';
import { isLaneAudible, totalPatternSteps } from './patternModel';
import type { ScheduledSequencerEvent, SequencerEvent, SequencerPattern } from './types';

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

export const swingOffsetSteps = (pattern: SequencerPattern, stepIndex: number): number =>
  stepIndex % 2 === 1 ? (pattern.swing / 100) * (1 / 3) : 0;

export const combinedTimingOffsetSteps = (
  pattern: SequencerPattern,
  event: SequencerEvent,
): number =>
  Math.max(
    -0.45,
    Math.min(0.45, swingOffsetSteps(pattern, event.stepIndex) + event.transform.timingOffsetSteps),
  );

export const eventTimeSeconds = (
  pattern: SequencerPattern,
  event: SequencerEvent,
  loopIndex = 0,
): number =>
  stepTimeSeconds(pattern, event.stepIndex, loopIndex) +
  combinedTimingOffsetSteps(pattern, event) * stepDurationSeconds(pattern.bpm);

export const microtimingMilliseconds = (pattern: SequencerPattern, event: SequencerEvent): number =>
  event.transform.timingOffsetSteps * stepDurationSeconds(pattern.bpm) * 1000;

export const maximumEarlyOffsetSeconds = (pattern: SequencerPattern): number =>
  Math.max(
    0,
    ...pattern.events.map((event) =>
      Math.max(0, -combinedTimingOffsetSteps(pattern, event) * stepDurationSeconds(pattern.bpm)),
    ),
  );

export const dynamicTransportStartLeadSeconds = (pattern: SequencerPattern): number =>
  Math.max(0.02, maximumEarlyOffsetSeconds(pattern) + TRANSFORM_TIMING_SAFETY_MARGIN_SECONDS);

export const dynamicScheduleAheadSeconds = (pattern: SequencerPattern): number =>
  Math.min(
    MAX_DYNAMIC_SCHEDULE_AHEAD_SECONDS,
    Math.max(
      SEQUENCER_SCHEDULE_AHEAD_SECONDS,
      maximumEarlyOffsetSeconds(pattern) + TRANSFORM_TIMING_SAFETY_MARGIN_SECONDS,
    ),
  );

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
  seed?: string;
  maxVoices?: number;
}

export interface ScheduleWindowResult {
  scheduled: ScheduledSequencerEvent[];
  invalidSkipped: number;
  mutedSkipped: number;
  duplicateSkipped: number;
  voiceLimitSkipped: number;
  probabilitySkipped: number;
  granularFallbacks: number;
}

export const deterministicUnitValue = (parts: Array<string | number>): number =>
  createPrng(parts.map(String).join('-')).next();

export const probabilityAllowsEvent = (input: {
  seed: string;
  event: SequencerEvent;
  loopIndex: number;
}): boolean => {
  if (input.event.transform.probability >= 1) return true;
  if (input.event.transform.probability <= 0) return false;
  return (
    deterministicUnitValue([input.seed, input.event.id, input.loopIndex, 'probability']) <
    input.event.transform.probability
  );
};

const ratchetGain = (event: SequencerEvent, ratchetIndex: number): number => {
  const count = event.transform.ratchetCount;
  if (count <= 1) return 1;
  const progress = ratchetIndex / Math.max(1, count - 1);
  return 1 - (1 - 0.25) * event.transform.ratchetDecay * progress;
};

const grainPlaybackRate = (input: {
  event: SequencerEvent;
  seed: string;
  loopIndex: number;
  ratchetIndex: number;
  grainIndex: number;
}): number => {
  const jitter = input.event.transform.grainPitchJitterSemitones;
  if (jitter <= 0) return pitchToPlaybackRate(input.event.pitchSemitones);
  const unit =
    deterministicUnitValue([
      input.seed,
      input.event.id,
      input.loopIndex,
      input.ratchetIndex,
      input.grainIndex,
      'grain-pitch',
    ]) *
      2 -
    1;
  return pitchToPlaybackRate(input.event.pitchSemitones + unit * jitter);
};

const grainOffsetSeconds = (input: {
  event: SequencerEvent;
  slice: SliceRegion;
  seed: string;
  loopIndex: number;
  ratchetIndex: number;
  grainIndex: number;
  grainDurationSeconds: number;
}): number => {
  const available = Math.max(0, input.slice.durationSeconds - input.grainDurationSeconds);
  const base = input.slice.startSeconds + input.event.transform.grainPosition * available;
  if (input.event.transform.grainSpray <= 0 || available <= 0) return base;
  const unit =
    deterministicUnitValue([
      input.seed,
      input.event.id,
      input.loopIndex,
      input.ratchetIndex,
      input.grainIndex,
      'grain-position',
    ]) *
      2 -
    1;
  const spraySeconds = available * input.event.transform.grainSpray * 0.5;
  return Math.max(
    input.slice.startSeconds,
    Math.min(input.slice.endSeconds - input.grainDurationSeconds, base + unit * spraySeconds),
  );
};

export const scheduleWindow = (input: ScheduleWindowInput): ScheduleWindowResult => {
  const patternDuration = patternDurationSeconds(input.pattern);
  const slicesById = new Map(input.slices.map((slice) => [slice.id, slice]));
  const scheduled: ScheduledSequencerEvent[] = [];
  let invalidSkipped = 0;
  let mutedSkipped = 0;
  let duplicateSkipped = 0;
  let voiceLimitSkipped = 0;
  let probabilitySkipped = 0;
  let granularFallbacks = 0;
  if (patternDuration <= 0 || input.windowEndSeconds <= input.windowStartSeconds) {
    return {
      scheduled,
      invalidSkipped,
      mutedSkipped,
      duplicateSkipped,
      voiceLimitSkipped,
      probabilitySkipped,
      granularFallbacks,
    };
  }

  const seed = input.seed ?? 'drumulizer-080';
  const scheduleLead = dynamicScheduleAheadSeconds(input.pattern);
  const firstLoop = Math.max(
    0,
    Math.floor((input.windowStartSeconds - scheduleLead) / patternDuration) - 1,
  );
  const lastLoop = Math.max(
    firstLoop,
    Math.floor(Math.max(0, input.windowEndSeconds + scheduleLead - 0.000001) / patternDuration),
  );
  const maxVoices = input.maxVoices ?? MAX_ACTIVE_SEQUENCER_VOICES;
  for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex += 1) {
    if (!input.pattern.loopEnabled && loopIndex > 0) break;
    for (const event of input.pattern.events) {
      if (!isLaneAudible(input.pattern.lanes, event.laneId)) {
        mutedSkipped += 1;
        continue;
      }
      const eventTime = eventTimeSeconds(input.pattern, event, loopIndex);
      if (eventTime < input.windowStartSeconds || eventTime >= input.windowEndSeconds) continue;
      const eventKey = `${loopIndex}:${event.id}:${event.stepIndex}`;
      const slice = slicesById.get(event.sliceId);
      if (!slice) {
        invalidSkipped += 1;
        input.scheduledKeys.add(eventKey);
        continue;
      }
      if (!probabilityAllowsEvent({ seed, event, loopIndex })) {
        probabilitySkipped += 1;
        input.scheduledKeys.add(eventKey);
        continue;
      }
      const plan = buildEventAudioPlan({
        event,
        slice,
        lane: input.pattern.lanes[event.laneId],
        masterGain: input.masterGain,
      });
      const ratchetCount = Math.max(1, event.transform.ratchetCount);
      const ratchetInterval = stepDurationSeconds(input.pattern.bpm) / ratchetCount;
      for (let ratchetIndex = 0; ratchetIndex < ratchetCount; ratchetIndex += 1) {
        const triggerTime = eventTime + ratchetIndex * ratchetInterval;
        const triggerWindow =
          ratchetCount > 1 ? ratchetInterval * 0.88 : stepDurationSeconds(input.pattern.bpm);
        const mode = event.transform.playbackMode;
        const grainCount = mode === 'granular' ? event.transform.grainCount : 1;
        const requestedGrainSeconds = event.transform.grainSizeMs / 1000;
        const effectiveGrainSeconds = Math.min(
          requestedGrainSeconds,
          slice.durationSeconds,
          triggerWindow * 0.9,
        );
        const useGranular = mode === 'granular' && effectiveGrainSeconds >= 0.005;
        if (mode === 'granular' && !useGranular) granularFallbacks += 1;
        const voiceCount = useGranular ? Math.min(grainCount, MAX_EVENT_EXPANDED_VOICES) : 1;
        for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex += 1) {
          const key = `${eventKey}:${ratchetIndex}:${useGranular ? voiceIndex : 'slice'}`;
          if (input.scheduledKeys.has(key)) {
            duplicateSkipped += 1;
            continue;
          }
          if (scheduled.length >= maxVoices) {
            voiceLimitSkipped += 1;
            continue;
          }
          const grainStartJitter =
            useGranular && voiceCount > 1
              ? (deterministicUnitValue([
                  seed,
                  event.id,
                  loopIndex,
                  ratchetIndex,
                  voiceIndex,
                  'grain-time',
                ]) -
                  0.5) *
                (triggerWindow / voiceCount) *
                0.4
              : 0;
          const relativeVoiceTime = useGranular
            ? (voiceIndex / voiceCount) * triggerWindow + grainStartJitter
            : 0;
          const durationSeconds = useGranular
            ? effectiveGrainSeconds
            : ratchetCount > 1
              ? Math.min(plan.durationSeconds, triggerWindow)
              : plan.durationSeconds;
          const playbackRate = useGranular
            ? grainPlaybackRate({ event, seed, loopIndex, ratchetIndex, grainIndex: voiceIndex })
            : plan.playbackRate;
          const offsetSeconds = useGranular
            ? grainOffsetSeconds({
                event,
                slice,
                seed,
                loopIndex,
                ratchetIndex,
                grainIndex: voiceIndex,
                grainDurationSeconds: durationSeconds,
              })
            : plan.offsetSeconds;
          input.scheduledKeys.add(key);
          scheduled.push({
            eventId: event.id,
            laneId: event.laneId,
            stepIndex: event.stepIndex,
            loopIndex,
            voiceIndex: scheduled.length,
            ratchetIndex,
            grainIndex: useGranular ? voiceIndex : null,
            playbackMode: useGranular ? 'granular' : 'slice',
            reverse: event.transform.reverse,
            audioTimeSeconds: input.transportOriginSeconds + triggerTime + relativeVoiceTime,
            offsetSeconds,
            durationSeconds,
            sourceDurationSeconds: useGranular ? durationSeconds : plan.sourceDurationSeconds,
            playbackRate,
            eventGain:
              plan.eventGain *
              ratchetGain(event, ratchetIndex) *
              (useGranular ? 1 / Math.sqrt(voiceCount) : 1),
            laneGain: plan.laneGain,
            pan: plan.pan,
            fadeSeconds: eventFadeSeconds(durationSeconds),
          });
        }
      }
    }
  }

  scheduled.sort(
    (left, right) =>
      left.audioTimeSeconds - right.audioTimeSeconds ||
      left.stepIndex - right.stepIndex ||
      left.laneId.localeCompare(right.laneId),
  );
  return {
    scheduled,
    invalidSkipped,
    mutedSkipped,
    duplicateSkipped,
    voiceLimitSkipped,
    probabilitySkipped,
    granularFallbacks,
  };
};

export const expectedStepsPerLoop = (): number =>
  SEQUENCER_BEATS_PER_BAR * SEQUENCER_STEPS_PER_BEAT;
