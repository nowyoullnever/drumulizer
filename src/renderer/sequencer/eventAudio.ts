import { SEQUENCER_EVENT_FADE_MS } from '../../shared/constants/sequencer';
import type { SliceRegion } from '../slice/types';
import type { SequencerEvent, SequencerLaneState } from './types';

export const velocityToGain = (velocity: number): number => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(velocity) ? velocity : 0));
  return clamped * clamped;
};

export const dbToGain = (db: number): number => {
  const finite = Number.isFinite(db) ? db : 0;
  return 10 ** (finite / 20);
};

export const pitchToPlaybackRate = (semitones: number): number => {
  const clamped = Math.max(-24, Math.min(24, Number.isFinite(semitones) ? semitones : 0));
  return Math.max(0.25, Math.min(4, 2 ** (clamped / 12)));
};

export const eventPlaybackDuration = (slice: SliceRegion, event: SequencerEvent): number => {
  const playbackRate = pitchToPlaybackRate(event.pitchSemitones);
  return Math.max(0, slice.durationSeconds / playbackRate);
};

export const eventFadeSeconds = (durationSeconds: number): number => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(SEQUENCER_EVENT_FADE_MS / 1000, durationSeconds * 0.25);
};

export const buildEventAudioPlan = (input: {
  event: SequencerEvent;
  slice: SliceRegion;
  lane: SequencerLaneState;
  masterGain: number;
}) => {
  const playbackRate = pitchToPlaybackRate(input.event.pitchSemitones);
  const durationSeconds = eventPlaybackDuration(input.slice, input.event);
  const fadeSeconds = eventFadeSeconds(durationSeconds);
  const eventGain = velocityToGain(input.event.velocity);
  const laneGain = dbToGain(input.lane.gainDb);
  return {
    offsetSeconds: input.slice.startSeconds,
    durationSeconds,
    sourceDurationSeconds: input.slice.durationSeconds,
    playbackRate,
    eventGain,
    laneGain,
    masterGain: Math.max(0, Math.min(1, Number.isFinite(input.masterGain) ? input.masterGain : 1)),
    pan: Math.max(-1, Math.min(1, Number.isFinite(input.event.pan) ? input.event.pan : 0)),
    fadeSeconds,
    outputGain: eventGain * laneGain * input.masterGain,
  };
};
