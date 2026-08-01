import { calculateEffectiveRole } from '../../audio/sliceAnalysis/roleScoring';
import type {
  SliceAnalysis,
  SliceGenerationRecommendation,
  SliceLaneScores,
} from '../../audio/sliceAnalysis/sliceAnalysisTypes';
import type { SliceRegion } from '../../slice/types';
import type { SequencerLaneId } from '../types';
import { sequencerLaneOrder } from '../types';
import type { GeneratorSliceInput } from './generatorTypes';

export interface WeightedSliceCandidate {
  slice: SliceRegion;
  analysis: SliceAnalysis;
  laneId: SequencerLaneId;
  effectiveRole: SequencerLaneId | 'unclassified';
  weight: number;
  exactRole: boolean;
  fallback: boolean;
  recommendedFallback: boolean;
}

export type SliceCandidatePools = Record<SequencerLaneId, WeightedSliceCandidate[]>;

const recommendationPenalty: Record<SliceGenerationRecommendation, number> = {
  'anchor-low-transient': 1.08,
  'use-as-body-hit': 1.04,
  'place-on-backbeat-accent': 1.04,
  'layer-as-mid-body': 1,
  'use-as-tick-or-ghost': 1,
  'trim-before-dense-use': 0.82,
  'reserve-for-tail-space': 0.82,
  'use-as-textural-fill': 1,
  'review-or-exclude-before-generation': 0.18,
};

const finiteLaneScore = (scores: SliceLaneScores, laneId: SequencerLaneId): number => {
  const score = scores[laneId];
  return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
};

const isTechnicallyUsable = (slice: SliceRegion, analysis: SliceAnalysis): boolean =>
  slice.durationSeconds > 0.005 &&
  slice.endSeconds > slice.startSeconds &&
  Number.isFinite(analysis.features.rmsDb) &&
  analysis.features.rmsDb > -72 &&
  sequencerLaneOrder.some((laneId) => finiteLaneScore(analysis.laneScores, laneId) > 0);

const candidateWeight = (
  laneId: SequencerLaneId,
  effectiveRole: SequencerLaneId | 'unclassified',
  analysis: SliceAnalysis,
  recentUse: Map<string, number>,
): number => {
  const suitability = finiteLaneScore(analysis.laneScores, laneId);
  const confidence = Number.isFinite(analysis.confidence)
    ? Math.max(0, Math.min(1, analysis.confidence))
    : 0;
  const confidenceFactor = 0.5 + confidence * 0.5;
  const roleFactor =
    effectiveRole === laneId ? 1.35 : effectiveRole === 'unclassified' ? 0.9 : 0.66;
  const warningPenalty = analysis.warnings.length === 0 ? 1 : 0.85;
  const durationPenalty = analysis.features.durationMs > 900 ? 0.72 : 1;
  const recommendationFactor = recommendationPenalty[analysis.generationRecommendation] ?? 0.85;
  const recentPenalty = 1 / (1 + (recentUse.get(analysis.sliceId) ?? 0) * 0.35);
  return (
    suitability *
    suitability *
    confidenceFactor *
    roleFactor *
    warningPenalty *
    durationPenalty *
    recommendationFactor *
    recentPenalty
  );
};

export const createSliceCandidatePools = (
  input: GeneratorSliceInput,
  recentUse = new Map<string, number>(),
): SliceCandidatePools => {
  const analysisById = new Map(input.analyses.map((analysis) => [analysis.sliceId, analysis]));
  const pools: SliceCandidatePools = { low: [], mid: [], high: [], texture: [] };
  for (const slice of input.slices) {
    const analysis = analysisById.get(slice.id);
    if (
      !analysis ||
      input.annotations.excluded[slice.id] ||
      !isTechnicallyUsable(slice, analysis)
    ) {
      continue;
    }
    const effectiveRole = calculateEffectiveRole(
      analysis,
      input.annotations.overrides[slice.id],
      Boolean(input.annotations.excluded[slice.id]),
    );
    for (const laneId of sequencerLaneOrder) {
      const weight = candidateWeight(laneId, effectiveRole, analysis, recentUse);
      if (weight <= 0.0001) continue;
      pools[laneId].push({
        slice,
        analysis,
        laneId,
        effectiveRole,
        weight,
        exactRole: effectiveRole === laneId,
        fallback: effectiveRole !== laneId,
        recommendedFallback:
          analysis.generationRecommendation === 'review-or-exclude-before-generation',
      });
    }
  }
  for (const laneId of sequencerLaneOrder) {
    pools[laneId].sort(
      (left, right) => right.weight - left.weight || left.slice.id.localeCompare(right.slice.id),
    );
  }
  return pools;
};
