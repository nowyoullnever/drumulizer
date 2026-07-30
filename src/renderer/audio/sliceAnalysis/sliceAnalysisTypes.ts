import type { SliceRegion } from '../../slice/types';

export type SliceAnalysisLifecycle =
  'unavailable' | 'not-analyzed' | 'analyzing' | 'ready' | 'stale' | 'error';

export type SlicePrimaryRole = 'low' | 'mid' | 'high' | 'texture' | 'unclassified';
export type SliceLaneRole = Exclude<SlicePrimaryRole, 'unclassified'>;
export type SliceRoleOverride = SliceLaneRole | 'auto';

export type SliceMicroRole =
  'sub' | 'body' | 'crack' | 'tick' | 'noise' | 'tonal' | 'texture' | 'tail' | 'hybrid';

export type SliceGenerationRecommendation =
  | 'anchor-low-transient'
  | 'use-as-body-hit'
  | 'place-on-backbeat-accent'
  | 'layer-as-mid-body'
  | 'use-as-tick-or-ghost'
  | 'trim-before-dense-use'
  | 'reserve-for-tail-space'
  | 'use-as-textural-fill'
  | 'review-or-exclude-before-generation';

export interface SliceRawFeatures {
  durationMs: number;
  rmsDb: number;
  peakDb: number;
  crestFactor: number;
  clippingRatio: number;
  zeroCrossingRate: number;
  attackMs: number;
  decayMs: number;
  earlyEnergyRatio: number;
  tailEnergyRatio: number;
  transientStrength: number;
  subEnergyRatio: number;
  lowMidEnergyRatio: number;
  highMidEnergyRatio: number;
  highEnergyRatio: number;
  spectralCentroidHz: number;
  spectralRolloffHz: number;
  spectralFlatness: number;
  spectralEntropy: number;
  spectralFluxMean: number;
  spectralFluxPeak: number;
  highFrequencyContent: number;
  pitchSalience: number;
}

export type SliceNormalizedFeatures = Record<keyof SliceRawFeatures, number>;
export type SliceMicroRoleScores = Record<SliceMicroRole, number>;
export type SliceLaneScores = Record<SliceLaneRole, number>;

export interface SliceAnalysis {
  sliceId: string;
  index: number;
  features: SliceRawFeatures;
  normalizedFeatures: SliceNormalizedFeatures;
  microScores: SliceMicroRoleScores;
  laneScores: SliceLaneScores;
  automaticRole: SlicePrimaryRole;
  confidence: number;
  warnings: string[];
  generationRecommendation: SliceGenerationRecommendation;
}

export interface SliceAnalysisSummary {
  total: number;
  analyzed: number;
  roleCounts: Record<SlicePrimaryRole, number>;
  warningCount: number;
}

export interface SliceAnalysisRequest {
  requestId: string;
  sourceId: string;
  sliceSetSignature: string;
  monoData: Float32Array;
  originalSampleRate: number;
  slices: SliceRegion[];
}

export interface SliceAnalysisResult {
  requestId: string;
  sourceId: string;
  sliceSetSignature: string;
  analyses: SliceAnalysis[];
  summary: SliceAnalysisSummary;
}

export type SliceAnalysisWorkerMessage =
  | { type: 'progress'; requestId: string; progress: number }
  | { type: 'complete'; result: SliceAnalysisResult }
  | { type: 'error'; requestId: string; message: string };

export interface SliceAnnotationState {
  overrides: Record<string, SliceRoleOverride>;
  excluded: Record<string, boolean>;
}

export type SliceLibraryFilter = SlicePrimaryRole | 'all' | 'included' | 'excluded';
export type SliceLibrarySort = 'index' | 'role' | 'confidence' | 'duration' | 'rms';
