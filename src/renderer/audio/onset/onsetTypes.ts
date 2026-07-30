import { MAX_SLICE_MARKERS } from '../../../shared/constants/slice';

export const DEFAULT_ONSET_SENSITIVITY = 55;
export const DEFAULT_ONSET_MINIMUM_GAP_MS = 45;
export const MIN_ONSET_GAP_MS = 20;
export const MAX_ONSET_GAP_MS = 250;
export const TARGET_ANALYSIS_SAMPLE_RATE = 24000;
export const ONSET_CANDIDATE_LIMIT = MAX_SLICE_MARKERS;

export type OnsetBand = 'low' | 'low-mid' | 'high-mid' | 'high' | 'broadband';

export type OnsetAnalysisReason = 'SILENT_SOURCE' | 'INVALID_SOURCE' | 'CANDIDATE_LIMIT_REACHED';

export interface OnsetDetectionSettings {
  sensitivity: number;
  minimumGapMs: number;
}

export interface OnsetAnalysisRequest {
  requestId: string;
  monoData: Float32Array;
  originalSampleRate: number;
  settings: OnsetDetectionSettings;
}

export interface OnsetCandidate {
  id: string;
  sampleIndex: number;
  timeSeconds: number;
  confidence: number;
  score: number;
  dominantBand: OnsetBand;
}

export interface OnsetAnalysisResult {
  requestId: string;
  candidates: OnsetCandidate[];
  settings: OnsetDetectionSettings;
  analysisSampleRate: number;
  frameSize: number;
  hopSize: number;
  sourceLengthSamples: number;
  capped: boolean;
  reason?: OnsetAnalysisReason;
}

export type OnsetWorkerMessage =
  | { type: 'complete'; result: OnsetAnalysisResult }
  | { type: 'progress'; requestId: string; progress: number }
  | { type: 'error'; requestId: string; message: string };

export type OnsetApplyMode = 'replace' | 'merge';

export interface OnsetPreview {
  sourceId: string;
  requestId: string;
  settingsKey: string;
  candidates: OnsetCandidate[];
  capped: boolean;
  reason?: OnsetAnalysisReason;
}

export interface OnsetApplySummary {
  markersApplied: number;
  candidatesSkipped: number;
  capped: boolean;
}

export const clampOnsetSettings = (settings: OnsetDetectionSettings): OnsetDetectionSettings => ({
  sensitivity: Math.max(0, Math.min(100, Math.round(settings.sensitivity))),
  minimumGapMs: Math.max(
    MIN_ONSET_GAP_MS,
    Math.min(MAX_ONSET_GAP_MS, Math.round(settings.minimumGapMs)),
  ),
});

export const onsetSettingsKey = (settings: OnsetDetectionSettings): string => {
  const clamped = clampOnsetSettings(settings);
  return `${clamped.sensitivity}:${clamped.minimumGapMs}`;
};
