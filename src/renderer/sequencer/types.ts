import type { SliceRegion } from '../slice/types';

export type SequencerLaneId = 'low' | 'mid' | 'high' | 'texture';
export const sequencerLaneOrder: SequencerLaneId[] = ['low', 'mid', 'high', 'texture'];

export interface SequencerLaneState {
  id: SequencerLaneId;
  gainDb: number;
  muted: boolean;
  soloed: boolean;
  generationLocked: boolean;
}

export type SequencerEventOrigin = 'manual' | 'generated' | 'mutated';
export type EventPlaybackMode = 'slice' | 'granular';

export interface SequencerEventTransform {
  probability: number;
  timingOffsetSteps: number;
  ratchetCount: number;
  ratchetDecay: number;
  reverse: boolean;
  playbackMode: EventPlaybackMode;
  grainSizeMs: number;
  grainCount: number;
  grainPosition: number;
  grainSpray: number;
  grainPitchJitterSemitones: number;
}

export interface SequencerEvent {
  id: string;
  laneId: SequencerLaneId;
  stepIndex: number;
  sliceId: string;
  velocity: number;
  pan: number;
  pitchSemitones: number;
  origin: SequencerEventOrigin;
  locked: boolean;
  transform: SequencerEventTransform;
}

export interface SequencerPattern {
  bpm: number;
  bars: number;
  beatsPerBar: 4;
  stepsPerBeat: 4;
  swing: number;
  events: SequencerEvent[];
  lanes: Record<SequencerLaneId, SequencerLaneState>;
  loopEnabled: boolean;
}

export type SequencerTransportStatus = 'stopped' | 'playing' | 'paused';

export interface SequencerTransportState {
  status: SequencerTransportStatus;
  currentStep: number;
  positionBeats: number;
}

export type SequencerTool = 'select' | 'paint' | 'erase';
export type MainWorkspaceMode = 'library' | 'sequencer';
export type GenerationMode = 'preserve-manual' | 'replace-unlocked';
export type GenerationScope = 'all' | SequencerLaneId;

export interface PatternGeneratorSettings {
  seed: string;
  density: number;
  variation: number;
  breakage: number;
  mode: GenerationMode;
  scope: GenerationScope;
}

export interface PatternMutationState {
  baseSeed: string;
  mutationIndex: number;
}

export interface IDMTransformSettings {
  seed: string;
  intensity: number;
  mode: GenerationMode;
  scope: GenerationScope;
  probabilityEnabled: boolean;
  timingEnabled: boolean;
  ratchetEnabled: boolean;
  reverseEnabled: boolean;
  granularEnabled: boolean;
  applyAfterGeneration: boolean;
}

export interface IDMTransformMutationState {
  baseSeed: string;
  mutationIndex: number;
}

export interface PatternEditResult {
  pattern: SequencerPattern;
  selectedEventId: string | null;
  changed: boolean;
  removedCount?: number;
}

export interface SequencerSliceContext {
  slice: SliceRegion;
  effectiveRole: SequencerLaneId | 'unclassified';
  excluded: boolean;
  confidence: number | null;
}

export interface ScheduledSequencerEvent {
  eventId: string;
  laneId: SequencerLaneId;
  stepIndex: number;
  loopIndex: number;
  voiceIndex: number;
  ratchetIndex: number;
  grainIndex: number | null;
  playbackMode: EventPlaybackMode;
  reverse: boolean;
  audioTimeSeconds: number;
  offsetSeconds: number;
  durationSeconds: number;
  sourceDurationSeconds: number;
  playbackRate: number;
  eventGain: number;
  laneGain: number;
  pan: number;
  fadeSeconds: number;
}
