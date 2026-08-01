import {
  MAX_EVENT_PAN,
  MAX_EVENT_PITCH_SEMITONES,
  MAX_EVENT_VELOCITY,
  MAX_PATTERN_EVENTS,
  MIN_EVENT_PAN,
  MIN_EVENT_PITCH_SEMITONES,
  MIN_EVENT_VELOCITY,
} from '../../../shared/constants/sequencer';
import { clampFinite, laneStepKey, normalizePattern, sortEvents } from '../patternModel';
import type { SequencerEvent, SequencerLaneId, SequencerPattern } from '../types';
import { sequencerLaneOrder } from '../types';
import type { GenerationResult, GeneratorActionInput, GenerationSummary } from './generatorTypes';
import {
  createDefaultMutationState,
  lanesInScope,
  normalizeGeneratorSettings,
} from './generatorTypes';
import { plannedStepsForLane, metricalWeight } from './rhythmGrammar';
import { createSliceCandidatePools, type WeightedSliceCandidate } from './slicePools';
import { createPrng, deterministicId } from './prng';

const emptyLaneCounts = (): Record<SequencerLaneId, number> =>
  Object.fromEntries(sequencerLaneOrder.map((laneId) => [laneId, 0])) as Record<
    SequencerLaneId,
    number
  >;

export const laneIsInScope = (
  laneId: SequencerLaneId,
  scope: ReturnType<typeof lanesInScope>,
): boolean => scope.includes(laneId);

export const isProtectedEvent = (
  event: SequencerEvent,
  pattern: SequencerPattern,
  scopedLanes: SequencerLaneId[],
  preserveManual: boolean,
): boolean =>
  !scopedLanes.includes(event.laneId) ||
  pattern.lanes[event.laneId].generationLocked ||
  event.locked ||
  (preserveManual && event.origin === 'manual');

const chooseCandidate = (
  pool: WeightedSliceCandidate[],
  prng: ReturnType<typeof createPrng>,
  recentUse: Map<string, number>,
  variation: number,
): WeightedSliceCandidate | null => {
  if (pool.length === 0) return null;
  const adjusted = pool.map((candidate) => ({
    candidate,
    weight:
      candidate.weight / (1 + (recentUse.get(candidate.slice.id) ?? 0) * (0.18 + variation / 120)),
  }));
  const total = adjusted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return adjusted[0].candidate;
  let roll = prng.next() * total;
  for (const item of adjusted) {
    roll -= item.weight;
    if (roll <= 0) return item.candidate;
  }
  return adjusted.at(-1)?.candidate ?? null;
};

const generatedVelocity = (
  laneId: SequencerLaneId,
  stepIndex: number,
  confidence: number,
  variation: number,
  prng: ReturnType<typeof createPrng>,
): number => {
  const stepInBar = stepIndex % 16;
  const base = laneId === 'high' ? 0.72 : laneId === 'texture' ? 0.64 : 0.82;
  const accent = metricalWeight(laneId, stepInBar) * 0.18;
  const spread = (variation / 100) * 0.18;
  const jitter = (prng.next() - 0.5) * spread;
  return clampFinite(
    base + accent + confidence * 0.08 + jitter,
    MIN_EVENT_VELOCITY,
    MAX_EVENT_VELOCITY,
    0.8,
  );
};

const generatedPan = (
  laneId: SequencerLaneId,
  variation: number,
  prng: ReturnType<typeof createPrng>,
): number => {
  const width = { low: 0.1, mid: 0.25, high: 0.6, texture: 0.75 }[laneId] * (variation / 100);
  return clampFinite((prng.next() * 2 - 1) * width, MIN_EVENT_PAN, MAX_EVENT_PAN, 0);
};

const generatedPitch = (
  laneId: SequencerLaneId,
  variation: number,
  prng: ReturnType<typeof createPrng>,
): number => {
  const max = { low: 2, mid: 3, high: 5, texture: 7 }[laneId] * (variation / 100);
  const value = Math.round((prng.next() * 2 - 1) * max);
  return Math.round(clampFinite(value, MIN_EVENT_PITCH_SEMITONES, MAX_EVENT_PITCH_SEMITONES, 0));
};

const makeSummary = (
  action: GenerationSummary['action'],
  seed: string,
  mutationIndex: number,
): GenerationSummary => ({
  action,
  seed,
  mutationIndex,
  added: 0,
  removed: 0,
  changed: 0,
  preserved: 0,
  conflicts: 0,
  fallbackLanes: [],
  emptyLanes: [],
  usedRecommendedFallback: 0,
  generatedByLane: emptyLaneCounts(),
  uniqueSliceCount: 0,
  messageKey: 'generator.summary.generated',
});

export const generatePattern = (input: GeneratorActionInput): GenerationResult => {
  const settings = normalizeGeneratorSettings(input.settings);
  const scopedLanes = lanesInScope(settings.scope);
  const preserveManual = input.action === 'generate' && settings.mode === 'preserve-manual';
  const prng = createPrng(
    `${settings.seed}-${input.action}-${settings.density}-${settings.variation}-${settings.breakage}-${settings.scope}-${settings.mode}`,
  );
  const recentUse = new Map<string, number>();
  for (const event of input.pattern.events)
    recentUse.set(event.sliceId, (recentUse.get(event.sliceId) ?? 0) + 1);
  const pools = createSliceCandidatePools(input.sliceInput, recentUse);
  const summary = makeSummary(input.action, settings.seed, 0);
  const protectedEvents = input.pattern.events.filter((event) =>
    isProtectedEvent(event, input.pattern, scopedLanes, preserveManual),
  );
  summary.preserved = protectedEvents.length;
  summary.removed = input.pattern.events.length - protectedEvents.length;
  const occupied = new Set(
    protectedEvents.map((event) => laneStepKey(event.laneId, event.stepIndex)),
  );
  const generated: SequencerEvent[] = [];
  for (const laneId of scopedLanes) {
    if (input.pattern.lanes[laneId].generationLocked) continue;
    const pool = pools[laneId];
    if (pool.length === 0) {
      summary.emptyLanes.push(laneId);
      continue;
    }
    if (pool.every((candidate) => candidate.fallback)) summary.fallbackLanes.push(laneId);
    const planned = plannedStepsForLane(
      input.pattern,
      laneId,
      settings.density,
      settings.variation,
      settings.breakage,
      prng,
    );
    for (const stepIndex of planned) {
      if (generated.length + protectedEvents.length >= MAX_PATTERN_EVENTS) break;
      const key = laneStepKey(laneId, stepIndex);
      if (occupied.has(key)) {
        summary.conflicts += 1;
        continue;
      }
      const candidate = chooseCandidate(pool, prng, recentUse, settings.variation);
      if (!candidate) continue;
      recentUse.set(candidate.slice.id, (recentUse.get(candidate.slice.id) ?? 0) + 1);
      if (candidate.recommendedFallback) summary.usedRecommendedFallback += 1;
      const event: SequencerEvent = {
        id: deterministicId([
          settings.seed,
          input.action,
          laneId,
          String(stepIndex),
          candidate.slice.id,
        ]),
        laneId,
        stepIndex,
        sliceId: candidate.slice.id,
        velocity: generatedVelocity(
          laneId,
          stepIndex,
          candidate.analysis.confidence,
          settings.variation,
          prng,
        ),
        pan: generatedPan(laneId, settings.variation, prng),
        pitchSemitones: generatedPitch(laneId, settings.variation, prng),
        origin: 'generated',
        locked: false,
      };
      generated.push(event);
      occupied.add(key);
      summary.generatedByLane[laneId] += 1;
    }
  }
  const nextPattern = normalizePattern({
    ...input.pattern,
    events: sortEvents([...protectedEvents, ...generated]),
  });
  summary.added = generated.length;
  summary.uniqueSliceCount = new Set(generated.map((event) => event.sliceId)).size;
  const changed = JSON.stringify(nextPattern.events) !== JSON.stringify(input.pattern.events);
  return {
    pattern: nextPattern,
    selectedEventId:
      nextPattern.events.find((event) => event.origin === 'generated')?.id ?? input.selectedEventId,
    changed,
    summary,
    mutationState: createDefaultMutationState(settings.seed),
  };
};
