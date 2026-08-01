import {
  DEFAULT_GENERATOR_BREAKAGE,
  DEFAULT_GENERATOR_DENSITY,
  DEFAULT_GENERATOR_SEED,
  DEFAULT_GENERATOR_VARIATION,
  MAX_GENERATOR_AMOUNT,
  MIN_GENERATOR_AMOUNT,
} from '../../../shared/constants/sequencer';
import type {
  SliceAnalysis,
  SliceAnnotationState,
} from '../../audio/sliceAnalysis/sliceAnalysisTypes';
import type { SliceRegion } from '../../slice/types';
import type {
  GenerationMode,
  GenerationScope,
  PatternGeneratorSettings,
  PatternMutationState,
  SequencerLaneId,
} from '../types';
import { normalizeSeed } from './prng';

export interface GeneratorSliceInput {
  slices: SliceRegion[];
  analyses: SliceAnalysis[];
  annotations: SliceAnnotationState;
}

export interface GeneratorActionInput {
  pattern: import('../types').SequencerPattern;
  selectedEventId: string | null;
  sliceInput: GeneratorSliceInput;
  settings: PatternGeneratorSettings;
  mutationState?: PatternMutationState;
  action: 'generate' | 'regenerate';
}

export interface MutatePatternInput {
  pattern: import('../types').SequencerPattern;
  selectedEventId: string | null;
  sliceInput: GeneratorSliceInput;
  settings: PatternGeneratorSettings;
  mutationState: PatternMutationState;
}

export interface GenerationSummary {
  action: 'generate' | 'regenerate' | 'mutate';
  seed: string;
  mutationIndex: number;
  added: number;
  removed: number;
  changed: number;
  preserved: number;
  conflicts: number;
  fallbackLanes: SequencerLaneId[];
  emptyLanes: SequencerLaneId[];
  usedRecommendedFallback: number;
  generatedByLane: Record<SequencerLaneId, number>;
  uniqueSliceCount: number;
  messageKey: string;
}

export interface GenerationResult {
  pattern: import('../types').SequencerPattern;
  selectedEventId: string | null;
  changed: boolean;
  summary: GenerationSummary;
  mutationState: PatternMutationState;
}

export const generationModes: GenerationMode[] = ['preserve-manual', 'replace-unlocked'];
export const generationScopes: GenerationScope[] = ['all', 'low', 'mid', 'high', 'texture'];

export const createDefaultGeneratorSettings = (): PatternGeneratorSettings => ({
  seed: DEFAULT_GENERATOR_SEED,
  density: DEFAULT_GENERATOR_DENSITY,
  variation: DEFAULT_GENERATOR_VARIATION,
  breakage: DEFAULT_GENERATOR_BREAKAGE,
  mode: 'preserve-manual',
  scope: 'all',
});

export const createDefaultMutationState = (
  seed = DEFAULT_GENERATOR_SEED,
): PatternMutationState => ({
  baseSeed: normalizeSeed(seed),
  mutationIndex: 0,
});

const clampAmount = (value: number, fallback: number): number => {
  const finite = Number.isFinite(value) ? value : fallback;
  return Math.round(Math.max(MIN_GENERATOR_AMOUNT, Math.min(MAX_GENERATOR_AMOUNT, finite)));
};

export const normalizeGeneratorSettings = (
  settings: PatternGeneratorSettings,
): PatternGeneratorSettings => ({
  seed: normalizeSeed(settings.seed),
  density: clampAmount(settings.density, DEFAULT_GENERATOR_DENSITY),
  variation: clampAmount(settings.variation, DEFAULT_GENERATOR_VARIATION),
  breakage: clampAmount(settings.breakage, DEFAULT_GENERATOR_BREAKAGE),
  mode: generationModes.includes(settings.mode) ? settings.mode : 'preserve-manual',
  scope: generationScopes.includes(settings.scope) ? settings.scope : 'all',
});

export const lanesInScope = (scope: GenerationScope): SequencerLaneId[] =>
  scope === 'all' ? ['low', 'mid', 'high', 'texture'] : [scope];
