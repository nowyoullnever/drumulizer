import {
  DEFAULT_GENERATOR_SEED,
  MAX_GENERATOR_AMOUNT,
  MIN_GENERATOR_AMOUNT,
} from '../../../shared/constants/sequencer';
import {
  DEFAULT_EVENT_TRANSFORM,
  normalizeEventTransform,
  normalizePattern,
  sortEvents,
} from '../patternModel';
import type {
  GenerationScope,
  IDMTransformMutationState,
  IDMTransformSettings,
  SequencerEvent,
  SequencerLaneId,
  SequencerPattern,
} from '../types';
import { sequencerLaneOrder } from '../types';
import { createPrng, normalizeSeed } from '../generator/prng';

export interface IDMTransformSummary {
  action: 'apply' | 'mutate' | 'reset';
  seed: string;
  mutationIndex: number;
  changed: number;
  preserved: number;
  probability: number;
  timing: number;
  ratchet: number;
  reverse: number;
  granular: number;
  messageKey: string;
}

export interface IDMTransformResult {
  pattern: SequencerPattern;
  selectedEventId: string | null;
  changed: boolean;
  summary: IDMTransformSummary;
  mutationState: IDMTransformMutationState;
}

export const createDefaultIDMTransformSettings = (): IDMTransformSettings => ({
  seed: DEFAULT_GENERATOR_SEED,
  intensity: 35,
  mode: 'preserve-manual',
  scope: 'all',
  probabilityEnabled: true,
  timingEnabled: true,
  ratchetEnabled: true,
  reverseEnabled: true,
  granularEnabled: true,
  applyAfterGeneration: true,
});

export const createDefaultIDMTransformMutationState = (
  seed = DEFAULT_GENERATOR_SEED,
): IDMTransformMutationState => ({
  baseSeed: normalizeSeed(seed),
  mutationIndex: 0,
});

export const normalizeIDMTransformSettings = (
  settings: IDMTransformSettings,
): IDMTransformSettings => ({
  seed: normalizeSeed(settings.seed),
  intensity: Math.round(
    Math.max(
      MIN_GENERATOR_AMOUNT,
      Math.min(MAX_GENERATOR_AMOUNT, Number.isFinite(settings.intensity) ? settings.intensity : 35),
    ),
  ),
  mode: settings.mode === 'replace-unlocked' ? 'replace-unlocked' : 'preserve-manual',
  scope:
    settings.scope === 'all' || sequencerLaneOrder.includes(settings.scope)
      ? settings.scope
      : 'all',
  probabilityEnabled: Boolean(settings.probabilityEnabled),
  timingEnabled: Boolean(settings.timingEnabled),
  ratchetEnabled: Boolean(settings.ratchetEnabled),
  reverseEnabled: Boolean(settings.reverseEnabled),
  granularEnabled: Boolean(settings.granularEnabled),
  applyAfterGeneration: Boolean(settings.applyAfterGeneration),
});

export const lanesInTransformScope = (scope: GenerationScope): SequencerLaneId[] =>
  scope === 'all' ? sequencerLaneOrder : [scope];

const makeSummary = (
  action: IDMTransformSummary['action'],
  seed: string,
  mutationIndex: number,
): IDMTransformSummary => ({
  action,
  seed,
  mutationIndex,
  changed: 0,
  preserved: 0,
  probability: 0,
  timing: 0,
  ratchet: 0,
  reverse: 0,
  granular: 0,
  messageKey: action === 'reset' ? 'idm.summary.reset' : 'idm.summary.applied',
});

const isProtected = (
  event: SequencerEvent,
  pattern: SequencerPattern,
  settings: IDMTransformSettings,
): boolean =>
  !lanesInTransformScope(settings.scope).includes(event.laneId) ||
  pattern.lanes[event.laneId].generationLocked ||
  event.locked ||
  (settings.mode === 'preserve-manual' && event.origin === 'manual');

const chanceForLane = (laneId: SequencerLaneId, base: number): number => {
  const laneBias = { low: 0.55, mid: 0.7, high: 1, texture: 1.15 }[laneId];
  return Math.max(0, Math.min(0.95, base * laneBias));
};

const decorateEvent = (
  event: SequencerEvent,
  settings: IDMTransformSettings,
  prng: ReturnType<typeof createPrng>,
  summary: IDMTransformSummary,
): SequencerEvent => {
  const amount = settings.intensity / 100;
  let transform = { ...DEFAULT_EVENT_TRANSFORM };

  if (settings.probabilityEnabled && prng.chance(chanceForLane(event.laneId, amount * 0.75))) {
    transform.probability = Math.max(0.25, 1 - amount * (0.15 + prng.next() * 0.45));
    summary.probability += 1;
  }

  if (settings.timingEnabled && prng.chance(chanceForLane(event.laneId, amount * 0.85))) {
    const direction = prng.chance(
      event.laneId === 'high' || event.laneId === 'texture' ? 0.62 : 0.48,
    )
      ? 1
      : -1;
    transform.timingOffsetSteps = direction * (0.04 + prng.next() * 0.34 * amount);
    summary.timing += 1;
  }

  if (settings.ratchetEnabled && prng.chance(chanceForLane(event.laneId, amount * 0.55))) {
    transform.ratchetCount =
      event.laneId === 'high' || event.laneId === 'texture' ? prng.int(2, 4) : prng.int(2, 3);
    transform.ratchetDecay = Math.min(1, 0.2 + prng.next() * amount);
    summary.ratchet += 1;
  }

  if (settings.reverseEnabled && prng.chance(chanceForLane(event.laneId, amount * 0.22))) {
    transform.reverse = true;
    summary.reverse += 1;
  }

  if (settings.granularEnabled && prng.chance(chanceForLane(event.laneId, amount * 0.35))) {
    transform.playbackMode = 'granular';
    transform.grainCount = prng.int(2, event.laneId === 'texture' ? 8 : 5);
    transform.grainSizeMs = prng.int(18, event.laneId === 'texture' ? 100 : 64);
    transform.grainPosition = Math.max(0, Math.min(1, 0.1 + prng.next() * 0.8));
    transform.grainSpray = Math.max(0, Math.min(1, 0.12 + prng.next() * amount));
    transform.grainPitchJitterSemitones = Math.round(prng.next() * amount * 12);
    summary.granular += 1;
  }

  transform = normalizeEventTransform(transform);
  return { ...event, transform };
};

export const applyIDMTransform = (input: {
  pattern: SequencerPattern;
  selectedEventId: string | null;
  settings: IDMTransformSettings;
  mutationState: IDMTransformMutationState;
  action: 'apply' | 'mutate';
}): IDMTransformResult => {
  const settings = normalizeIDMTransformSettings(input.settings);
  const mutationIndex = input.action === 'mutate' ? input.mutationState.mutationIndex + 1 : 0;
  const summary = makeSummary(input.action, settings.seed, mutationIndex);
  const seed =
    input.action === 'mutate'
      ? `${settings.seed}-idm-mutation-${mutationIndex}`
      : `${settings.seed}-idm-apply`;
  const prng = createPrng(`${seed}-${settings.intensity}-${settings.scope}-${settings.mode}`);
  const events = input.pattern.events.map((event) => {
    if (isProtected(event, input.pattern, settings)) {
      summary.preserved += 1;
      return event;
    }
    if (settings.intensity <= 0) return { ...event, transform: DEFAULT_EVENT_TRANSFORM };
    return decorateEvent(event, settings, prng, summary);
  });
  const pattern = normalizePattern({ ...input.pattern, events: sortEvents(events) });
  summary.changed = pattern.events.filter((event) => {
    const previous = input.pattern.events.find((candidate) => candidate.id === event.id);
    return previous && JSON.stringify(previous.transform) !== JSON.stringify(event.transform);
  }).length;
  summary.messageKey = input.action === 'mutate' ? 'idm.summary.mutated' : 'idm.summary.applied';
  return {
    pattern,
    selectedEventId: input.selectedEventId,
    changed: summary.changed > 0,
    summary,
    mutationState: {
      baseSeed: settings.seed,
      mutationIndex,
    },
  };
};

export const resetIDMTransforms = (input: {
  pattern: SequencerPattern;
  selectedEventId: string | null;
  settings: IDMTransformSettings;
}): IDMTransformResult => {
  const settings = normalizeIDMTransformSettings(input.settings);
  const summary = makeSummary('reset', settings.seed, 0);
  const events = input.pattern.events.map((event) => {
    if (isProtected(event, input.pattern, settings)) {
      summary.preserved += 1;
      return event;
    }
    return { ...event, transform: DEFAULT_EVENT_TRANSFORM };
  });
  const pattern = normalizePattern({ ...input.pattern, events: sortEvents(events) });
  summary.changed = pattern.events.filter((event) => {
    const previous = input.pattern.events.find((candidate) => candidate.id === event.id);
    return previous && JSON.stringify(previous.transform) !== JSON.stringify(event.transform);
  }).length;
  return {
    pattern,
    selectedEventId: input.selectedEventId,
    changed: summary.changed > 0,
    summary,
    mutationState: createDefaultIDMTransformMutationState(settings.seed),
  };
};
