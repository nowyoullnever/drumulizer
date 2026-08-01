import type {
  SliceAnalysis,
  SliceAnalysisResult,
} from '../../../audio/sliceAnalysis/sliceAnalysisTypes';
import type { SliceRegion } from '../../../slice/types';

const laneScores = (low: number, mid: number, high: number, texture: number) => ({
  low,
  mid,
  high,
  texture,
});

const analysis = (
  sliceId: string,
  index: number,
  scores: ReturnType<typeof laneScores>,
  automaticRole: SliceAnalysis['automaticRole'],
  confidence = 0.86,
  rmsDb = -18,
): SliceAnalysis => ({
  sliceId,
  index,
  features: {
    durationMs: 120,
    rmsDb,
    peakDb: -3,
    crestFactor: 8,
    clippingRatio: 0,
    zeroCrossingRate: 0.08,
    attackMs: 12,
    decayMs: 80,
    earlyEnergyRatio: 0.7,
    tailEnergyRatio: 0.2,
    transientStrength: 0.8,
    subEnergyRatio: scores.low,
    lowMidEnergyRatio: scores.mid,
    highMidEnergyRatio: scores.high,
    highEnergyRatio: scores.texture,
    spectralCentroidHz: 1200,
    spectralRolloffHz: 4000,
    spectralFlatness: 0.3,
    spectralEntropy: 0.4,
    spectralFluxMean: 0.2,
    spectralFluxPeak: 0.8,
    highFrequencyContent: scores.high,
    pitchSalience: 0.2,
  },
  normalizedFeatures: Object.fromEntries(
    [
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
    ].map((key) => [key, 0.5]),
  ) as SliceAnalysis['normalizedFeatures'],
  microScores: {
    sub: scores.low,
    body: scores.mid,
    crack: scores.high,
    tick: scores.high,
    noise: scores.texture,
    tonal: 0.2,
    texture: scores.texture,
    tail: 0.2,
    hybrid: 0.4,
  },
  laneScores: scores,
  automaticRole,
  confidence,
  warnings: confidence < 0.45 ? ['ambiguous'] : [],
  generationRecommendation:
    automaticRole === 'low'
      ? 'anchor-low-transient'
      : automaticRole === 'mid'
        ? 'use-as-body-hit'
        : automaticRole === 'high'
          ? 'use-as-tick-or-ghost'
          : automaticRole === 'texture'
            ? 'use-as-textural-fill'
            : 'review-or-exclude-before-generation',
});

export const generatedFixtureSlices = (): SliceRegion[] =>
  Array.from({ length: 12 }, (_, index) => ({
    id: `slice-${index + 1}`,
    index,
    startSample: index * 1000,
    endSample: index * 1000 + 800,
    durationSamples: 800,
    startSeconds: index * 0.1,
    endSeconds: index * 0.1 + 0.08,
    durationSeconds: 0.08,
    leftBoundaryId: `b-${index}`,
    rightBoundaryId: `b-${index + 1}`,
  }));

export const generatedFixtureAnalysis = (): SliceAnalysisResult => ({
  requestId: 'fixture',
  sourceId: 'fixture-source',
  sliceSetSignature: 'fixture-signature',
  analyses: [
    analysis('slice-1', 0, laneScores(0.95, 0.3, 0.1, 0.1), 'low'),
    analysis('slice-2', 1, laneScores(0.85, 0.32, 0.15, 0.1), 'low'),
    analysis('slice-3', 2, laneScores(0.2, 0.92, 0.25, 0.1), 'mid'),
    analysis('slice-4', 3, laneScores(0.25, 0.86, 0.3, 0.12), 'mid'),
    analysis('slice-5', 4, laneScores(0.1, 0.22, 0.94, 0.35), 'high'),
    analysis('slice-6', 5, laneScores(0.12, 0.25, 0.84, 0.42), 'high'),
    analysis('slice-7', 6, laneScores(0.12, 0.18, 0.38, 0.94), 'texture'),
    analysis('slice-8', 7, laneScores(0.15, 0.2, 0.45, 0.86), 'texture'),
    analysis('slice-9', 8, laneScores(0.45, 0.44, 0.42, 0.4), 'unclassified', 0.38),
    analysis('slice-10', 9, laneScores(0.05, 0.04, 0.04, 0.05), 'unclassified', 0.2, -90),
    analysis('slice-11', 10, laneScores(0.7, 0.68, 0.35, 0.3), 'mid', 0.72),
    analysis('slice-12', 11, laneScores(0.25, 0.3, 0.4, 0.75), 'texture', 0.66),
  ],
  summary: {
    total: 12,
    analyzed: 12,
    roleCounts: { low: 2, mid: 3, high: 2, texture: 3, unclassified: 2 },
    warningCount: 1,
  },
});
