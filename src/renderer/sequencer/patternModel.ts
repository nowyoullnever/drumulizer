import {
  DEFAULT_EVENT_PAN,
  DEFAULT_EVENT_PITCH_SEMITONES,
  DEFAULT_EVENT_VELOCITY,
  DEFAULT_PATTERN_BARS,
  DEFAULT_PATTERN_BPM,
  MAX_EVENT_PAN,
  MAX_EVENT_PITCH_SEMITONES,
  MAX_EVENT_VELOCITY,
  MAX_LANE_GAIN_DB,
  MAX_PATTERN_BARS,
  MAX_PATTERN_BPM,
  MAX_PATTERN_EVENTS,
  MIN_EVENT_PAN,
  MIN_EVENT_PITCH_SEMITONES,
  MIN_EVENT_VELOCITY,
  MIN_LANE_GAIN_DB,
  MIN_PATTERN_BARS,
  MIN_PATTERN_BPM,
  SEQUENCER_BEATS_PER_BAR,
  SEQUENCER_STEPS_PER_BAR,
  SEQUENCER_STEPS_PER_BEAT,
} from '../../shared/constants/sequencer';
import type { SliceRegion } from '../slice/types';
import type {
  PatternEditResult,
  SequencerEvent,
  SequencerLaneId,
  SequencerLaneState,
  SequencerPattern,
} from './types';
import { sequencerLaneOrder } from './types';

export const totalPatternSteps = (pattern: Pick<SequencerPattern, 'bars'>): number =>
  pattern.bars * SEQUENCER_STEPS_PER_BAR;

export const clampFinite = (value: number, min: number, max: number, fallback: number): number => {
  const finite = Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, finite));
};

export const createDefaultLanes = (): Record<SequencerLaneId, SequencerLaneState> =>
  Object.fromEntries(
    sequencerLaneOrder.map((id) => [id, { id, gainDb: 0, muted: false, soloed: false }]),
  ) as Record<SequencerLaneId, SequencerLaneState>;

export const createDefaultPattern = (): SequencerPattern => ({
  bpm: DEFAULT_PATTERN_BPM,
  bars: DEFAULT_PATTERN_BARS,
  beatsPerBar: SEQUENCER_BEATS_PER_BAR,
  stepsPerBeat: SEQUENCER_STEPS_PER_BEAT,
  events: [],
  lanes: createDefaultLanes(),
  loopEnabled: true,
});

export const createEventId = (laneId: SequencerLaneId, stepIndex: number): string =>
  `evt-${laneId}-${stepIndex.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const sortEvents = (events: SequencerEvent[]): SequencerEvent[] =>
  [...events].sort(
    (left, right) =>
      left.stepIndex - right.stepIndex ||
      sequencerLaneOrder.indexOf(left.laneId) - sequencerLaneOrder.indexOf(right.laneId) ||
      left.id.localeCompare(right.id),
  );

export const clampEvent = (
  event: SequencerEvent,
  pattern: Pick<SequencerPattern, 'bars'>,
): SequencerEvent => ({
  ...event,
  stepIndex: Math.round(clampFinite(event.stepIndex, 0, totalPatternSteps(pattern) - 1, 0)),
  velocity: clampFinite(
    event.velocity,
    MIN_EVENT_VELOCITY,
    MAX_EVENT_VELOCITY,
    DEFAULT_EVENT_VELOCITY,
  ),
  pan: clampFinite(event.pan, MIN_EVENT_PAN, MAX_EVENT_PAN, DEFAULT_EVENT_PAN),
  pitchSemitones: clampFinite(
    event.pitchSemitones,
    MIN_EVENT_PITCH_SEMITONES,
    MAX_EVENT_PITCH_SEMITONES,
    DEFAULT_EVENT_PITCH_SEMITONES,
  ),
});

export const normalizePattern = (pattern: SequencerPattern): SequencerPattern => {
  const bars = Math.round(
    clampFinite(pattern.bars, MIN_PATTERN_BARS, MAX_PATTERN_BARS, DEFAULT_PATTERN_BARS),
  );
  const bpm = Math.round(
    clampFinite(pattern.bpm, MIN_PATTERN_BPM, MAX_PATTERN_BPM, DEFAULT_PATTERN_BPM),
  );
  const steps = bars * SEQUENCER_STEPS_PER_BAR;
  const seen = new Set<string>();
  const events = sortEvents(
    pattern.events
      .filter(
        (event) =>
          sequencerLaneOrder.includes(event.laneId) &&
          event.stepIndex >= 0 &&
          event.stepIndex < steps,
      )
      .map((event) => clampEvent(event, { bars }))
      .filter((event) => {
        const key = laneStepKey(event.laneId, event.stepIndex);
        if (seen.has(key)) return false;
        seen.add(key);
        return seen.size <= MAX_PATTERN_EVENTS;
      }),
  );
  const lanes = createDefaultLanes();
  for (const id of sequencerLaneOrder) {
    lanes[id] = {
      ...lanes[id],
      ...pattern.lanes[id],
      id,
      gainDb: clampFinite(pattern.lanes[id]?.gainDb ?? 0, MIN_LANE_GAIN_DB, MAX_LANE_GAIN_DB, 0),
      muted: Boolean(pattern.lanes[id]?.muted),
      soloed: Boolean(pattern.lanes[id]?.soloed),
    };
  }
  return {
    bpm,
    bars,
    beatsPerBar: SEQUENCER_BEATS_PER_BAR,
    stepsPerBeat: SEQUENCER_STEPS_PER_BEAT,
    events,
    lanes,
    loopEnabled: Boolean(pattern.loopEnabled),
  };
};

export const laneStepKey = (laneId: SequencerLaneId, stepIndex: number): string =>
  `${laneId}:${stepIndex}`;

export const findEventAt = (
  pattern: SequencerPattern,
  laneId: SequencerLaneId,
  stepIndex: number,
): SequencerEvent | null =>
  pattern.events.find((event) => event.laneId === laneId && event.stepIndex === stepIndex) ?? null;

export const paintEvent = (input: {
  pattern: SequencerPattern;
  laneId: SequencerLaneId;
  stepIndex: number;
  sliceId: string | null;
}): PatternEditResult => {
  if (!input.sliceId) return { pattern: input.pattern, selectedEventId: null, changed: false };
  const stepIndex = Math.round(input.stepIndex);
  if (stepIndex < 0 || stepIndex >= totalPatternSteps(input.pattern)) {
    return { pattern: input.pattern, selectedEventId: null, changed: false };
  }
  const existing = findEventAt(input.pattern, input.laneId, stepIndex);
  const event: SequencerEvent = existing
    ? { ...existing, sliceId: input.sliceId }
    : {
        id: createEventId(input.laneId, stepIndex),
        laneId: input.laneId,
        stepIndex,
        sliceId: input.sliceId,
        velocity: DEFAULT_EVENT_VELOCITY,
        pan: DEFAULT_EVENT_PAN,
        pitchSemitones: DEFAULT_EVENT_PITCH_SEMITONES,
      };
  const events = existing
    ? input.pattern.events.map((candidate) => (candidate.id === existing.id ? event : candidate))
    : [...input.pattern.events, event];
  return {
    pattern: normalizePattern({ ...input.pattern, events }),
    selectedEventId: event.id,
    changed: true,
  };
};

export const removeEvent = (
  pattern: SequencerPattern,
  eventId: string | null,
): PatternEditResult => {
  if (!eventId) return { pattern, selectedEventId: null, changed: false };
  const events = pattern.events.filter((event) => event.id !== eventId);
  return {
    pattern: { ...pattern, events },
    selectedEventId: null,
    changed: events.length !== pattern.events.length,
  };
};

export const removeEventAt = (
  pattern: SequencerPattern,
  laneId: SequencerLaneId,
  stepIndex: number,
): PatternEditResult => removeEvent(pattern, findEventAt(pattern, laneId, stepIndex)?.id ?? null);

export const updateEvent = (
  pattern: SequencerPattern,
  eventId: string,
  patch: Partial<Pick<SequencerEvent, 'velocity' | 'pan' | 'pitchSemitones' | 'sliceId'>>,
): PatternEditResult => {
  let changed = false;
  const events = pattern.events.map((event) => {
    if (event.id !== eventId) return event;
    changed = true;
    return clampEvent({ ...event, ...patch }, pattern);
  });
  return { pattern: { ...pattern, events: sortEvents(events) }, selectedEventId: eventId, changed };
};

export const resetEventParameters = (
  pattern: SequencerPattern,
  eventId: string,
): PatternEditResult =>
  updateEvent(pattern, eventId, {
    velocity: DEFAULT_EVENT_VELOCITY,
    pan: DEFAULT_EVENT_PAN,
    pitchSemitones: DEFAULT_EVENT_PITCH_SEMITONES,
  });

export const setLaneState = (
  pattern: SequencerPattern,
  laneId: SequencerLaneId,
  patch: Partial<Omit<SequencerLaneState, 'id'>>,
): SequencerPattern =>
  normalizePattern({
    ...pattern,
    lanes: {
      ...pattern.lanes,
      [laneId]: { ...pattern.lanes[laneId], ...patch, id: laneId },
    },
  });

export const clearLane = (
  pattern: SequencerPattern,
  laneId: SequencerLaneId,
  selectedEventId: string | null,
): PatternEditResult => {
  const removed = pattern.events.filter((event) => event.laneId === laneId);
  const events = pattern.events.filter((event) => event.laneId !== laneId);
  return {
    pattern: { ...pattern, events },
    selectedEventId: removed.some((event) => event.id === selectedEventId) ? null : selectedEventId,
    changed: removed.length > 0,
    removedCount: removed.length,
  };
};

export const clearPattern = (pattern: SequencerPattern): PatternEditResult => ({
  pattern: { ...pattern, events: [] },
  selectedEventId: null,
  changed: pattern.events.length > 0,
  removedCount: pattern.events.length,
});

export const setPatternBars = (
  pattern: SequencerPattern,
  bars: number,
  selectedEventId: string | null,
): PatternEditResult => {
  const nextBars = Math.round(
    clampFinite(bars, MIN_PATTERN_BARS, MAX_PATTERN_BARS, DEFAULT_PATTERN_BARS),
  );
  const maxStep = nextBars * SEQUENCER_STEPS_PER_BAR;
  const removed = pattern.events.filter((event) => event.stepIndex >= maxStep);
  const events = pattern.events.filter((event) => event.stepIndex < maxStep);
  return {
    pattern: normalizePattern({ ...pattern, bars: nextBars, events }),
    selectedEventId: removed.some((event) => event.id === selectedEventId) ? null : selectedEventId,
    changed: nextBars !== pattern.bars || removed.length > 0,
    removedCount: removed.length,
  };
};

export const setPatternBpm = (pattern: SequencerPattern, bpm: number): SequencerPattern =>
  normalizePattern({ ...pattern, bpm });

export const reconcilePatternSlices = (input: {
  pattern: SequencerPattern;
  slices: SliceRegion[];
  selectedEventId: string | null;
}): PatternEditResult => {
  const validIds = new Set(input.slices.map((slice) => slice.id));
  const removed = input.pattern.events.filter((event) => !validIds.has(event.sliceId));
  const events = input.pattern.events.filter((event) => validIds.has(event.sliceId));
  return {
    pattern: { ...input.pattern, events },
    selectedEventId: removed.some((event) => event.id === input.selectedEventId)
      ? null
      : input.selectedEventId,
    changed: removed.length > 0,
    removedCount: removed.length,
  };
};

export const eventLocation = (
  event: SequencerEvent,
): { bar: number; beat: number; stepInBeat: number } => {
  const bar = Math.floor(event.stepIndex / SEQUENCER_STEPS_PER_BAR) + 1;
  const beat =
    Math.floor((event.stepIndex % SEQUENCER_STEPS_PER_BAR) / SEQUENCER_STEPS_PER_BEAT) + 1;
  const stepInBeat = (event.stepIndex % SEQUENCER_STEPS_PER_BEAT) + 1;
  return { bar, beat, stepInBeat };
};

export const isLaneAudible = (
  lanes: Record<SequencerLaneId, SequencerLaneState>,
  laneId: SequencerLaneId,
): boolean => {
  const lane = lanes[laneId];
  const anySolo = sequencerLaneOrder.some((id) => lanes[id].soloed);
  if (lane.muted) return false;
  return anySolo ? lane.soloed : true;
};
