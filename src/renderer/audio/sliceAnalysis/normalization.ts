import type { SliceNormalizedFeatures, SliceRawFeatures } from './sliceAnalysisTypes';

const featureKeys = [
  'durationMs',
  'rmsDb',
  'peakDb',
  'crestFactor',
  'clippingRatio',
  'zeroCrossingRate',
  'attackMs',
  'decayMs',
  'earlyEnergyRatio',
  'tailEnergyRatio',
  'transientStrength',
  'subEnergyRatio',
  'lowMidEnergyRatio',
  'highMidEnergyRatio',
  'highEnergyRatio',
  'spectralCentroidHz',
  'spectralRolloffHz',
  'spectralFlatness',
  'spectralEntropy',
  'spectralFluxMean',
  'spectralFluxPeak',
  'highFrequencyContent',
  'pitchSalience',
] as const satisfies readonly (keyof SliceRawFeatures)[];

export const normalizeSliceFeatures = (features: SliceRawFeatures[]): SliceNormalizedFeatures[] => {
  const stats = Object.fromEntries(
    featureKeys.map((key) => [key, robustRange(features.map((feature) => feature[key]))]),
  ) as Record<keyof SliceRawFeatures, { low: number; high: number }>;

  return features.map((feature) => {
    const normalized = {} as SliceNormalizedFeatures;
    for (const key of featureKeys) {
      const { low, high } = stats[key];
      normalized[key] = high > low ? clamp01((feature[key] - low) / (high - low)) : 0.5;
    }
    return normalized;
  });
};

const robustRange = (values: number[]): { low: number; high: number } => {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return { low: 0, high: 1 };
  const q10 = percentile(finite, 0.1);
  const q90 = percentile(finite, 0.9);
  const median = percentile(finite, 0.5);
  const madValues = finite
    .map((value) => Math.abs(value - median))
    .sort((left, right) => left - right);
  const mad = percentile(madValues, 0.5) * 1.4826;
  const low = Math.min(q10, median - mad * 2.5);
  const high = Math.max(q90, median + mad * 2.5, low + 0.000001);
  return { low, high };
};

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const position = (values.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
