import type {
  SliceAnalysis,
  SliceGenerationRecommendation,
  SliceLaneScores,
  SliceMicroRoleScores,
  SliceNormalizedFeatures,
  SlicePrimaryRole,
  SliceRawFeatures,
} from './sliceAnalysisTypes';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const weighted = (...parts: [number, number][]): number => {
  const sum = parts.reduce((acc, [value, weight]) => acc + clamp01(value) * weight, 0);
  const weights = parts.reduce((acc, [, weight]) => acc + weight, 0);
  return clamp01(sum / Math.max(0.000001, weights));
};

export const scoreSliceRoles = (
  sliceId: string,
  index: number,
  features: SliceRawFeatures,
  normalized: SliceNormalizedFeatures,
): SliceAnalysis => {
  const microScores: SliceMicroRoleScores = {
    sub: weighted(
      [features.subEnergyRatio * (1 - features.spectralFlatness * 0.55), 0.72],
      [1 - normalized.spectralCentroidHz, 0.28],
    ),
    body: weighted(
      [features.lowMidEnergyRatio, 0.54],
      [normalized.rmsDb, 0.2],
      [normalized.decayMs, 0.16],
      [features.pitchSalience, 0.1],
    ),
    crack: weighted(
      [features.highMidEnergyRatio, 0.38],
      [clamp01(features.transientStrength / 3), 0.34],
      [features.earlyEnergyRatio, 0.28],
    ),
    tick: weighted(
      [features.highEnergyRatio, 0.42],
      [features.highFrequencyContent, 0.34],
      [1 - normalized.durationMs, 0.14],
      [clamp01(features.transientStrength / 4), 0.1],
    ),
    noise: weighted(
      [features.spectralFlatness, 0.44],
      [features.spectralEntropy, 0.34],
      [features.highEnergyRatio + features.highMidEnergyRatio, 0.22],
    ),
    tonal: weighted(
      [features.pitchSalience, 0.58],
      [1 - features.spectralFlatness, 0.26],
      [1 - features.spectralEntropy, 0.16],
    ),
    texture: weighted(
      [features.spectralEntropy, 0.34],
      [features.spectralFlatness, 0.28],
      [normalized.spectralFluxMean, 0.2],
      [features.tailEnergyRatio, 0.18],
    ),
    tail: weighted(
      [normalized.tailEnergyRatio, 0.46],
      [normalized.decayMs, 0.34],
      [1 - normalized.transientStrength, 0.2],
    ),
    hybrid: weighted(
      [roleSpread(features), 0.55],
      [normalized.spectralFluxPeak, 0.25],
      [normalized.crestFactor, 0.2],
    ),
  };

  const laneScores: SliceLaneScores = {
    low: weighted(
      [microScores.sub, 0.5],
      [microScores.body, 0.28],
      [1 - normalized.spectralCentroidHz, 0.12],
      [1 - features.spectralFlatness, 0.1],
    ),
    mid: weighted(
      [microScores.body, 0.28],
      [microScores.crack, 0.34],
      [features.lowMidEnergyRatio + features.highMidEnergyRatio, 0.28],
      [clamp01(features.transientStrength / 4), 0.1],
    ),
    high: weighted(
      [microScores.tick, 0.46],
      [microScores.crack, 0.2],
      [features.highEnergyRatio, 0.18],
      [features.highFrequencyContent, 0.16],
    ),
    texture: weighted(
      [microScores.noise, 0.34],
      [microScores.texture, 0.34],
      [microScores.tail, 0.18],
      [microScores.hybrid, 0.14],
    ),
  };
  const automaticRole = choosePrimaryRole(laneScores, features);
  const confidence = calculateConfidence(laneScores, automaticRole);
  const warnings = warningsForSlice(features, confidence);

  return {
    sliceId,
    index,
    features,
    normalizedFeatures: normalized,
    microScores,
    laneScores,
    automaticRole,
    confidence,
    warnings,
    generationRecommendation: recommendationForRole(automaticRole, microScores, features),
  };
};

export const choosePrimaryRole = (
  laneScores: SliceLaneScores,
  features: SliceRawFeatures,
): SlicePrimaryRole => {
  const sorted = (Object.entries(laneScores) as [SlicePrimaryRole, number][]).sort(
    (left, right) => right[1] - left[1],
  );
  if (features.rmsDb < -64 || sorted[0][1] < 0.22) return 'unclassified';
  return sorted[0][0];
};

export const calculateEffectiveRole = (
  analysis: SliceAnalysis | null,
  override: string | undefined,
  excluded: boolean,
): SlicePrimaryRole => {
  if (!analysis || excluded) return 'unclassified';
  if (override && override !== 'auto') return override as SlicePrimaryRole;
  return analysis.automaticRole;
};

const calculateConfidence = (laneScores: SliceLaneScores, role: SlicePrimaryRole): number => {
  if (role === 'unclassified') return 0;
  const values = Object.values(laneScores).sort((left, right) => right - left);
  return clamp01(values[0] * 0.72 + Math.max(0, values[0] - values[1]) * 0.92);
};

const roleSpread = (features: SliceRawFeatures): number => {
  const ratios = [
    features.subEnergyRatio,
    features.lowMidEnergyRatio,
    features.highMidEnergyRatio,
    features.highEnergyRatio,
  ];
  return 1 - Math.max(...ratios);
};

const warningsForSlice = (features: SliceRawFeatures, confidence: number): string[] => {
  const warnings: string[] = [];
  if (features.durationMs < 12) warnings.push('very-short-slice');
  if (features.durationMs > 1400) warnings.push('long-slice');
  if (features.clippingRatio > 0.01) warnings.push('possible-clipping');
  if (features.rmsDb < -58) warnings.push('low-energy');
  if (confidence < 0.35) warnings.push('low-confidence-role');
  return warnings;
};

const recommendationForRole = (
  role: SlicePrimaryRole,
  microScores: SliceMicroRoleScores,
  features: SliceRawFeatures,
): SliceGenerationRecommendation => {
  if (role === 'low')
    return microScores.sub > microScores.body ? 'anchor-low-transient' : 'use-as-body-hit';
  if (role === 'mid')
    return microScores.crack > 0.55 ? 'place-on-backbeat-accent' : 'layer-as-mid-body';
  if (role === 'high')
    return features.durationMs < 80 ? 'use-as-tick-or-ghost' : 'trim-before-dense-use';
  if (role === 'texture')
    return microScores.tail > 0.55 ? 'reserve-for-tail-space' : 'use-as-textural-fill';
  return 'review-or-exclude-before-generation';
};
