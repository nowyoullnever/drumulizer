import type { OnsetCandidate } from '../onsetTypes';

export interface OnsetEvaluationFixture {
  name: string;
  samples: Float32Array;
  sampleRate: number;
  expectedSeconds: number[];
  maxCandidates?: number;
}

export interface OnsetEvaluationMetrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  meanAbsoluteTimingErrorMs: number;
  maximumTimingErrorMs: number;
  candidatesPerSecond: number;
}

export interface OnsetFixtureEvaluation {
  fixture: OnsetEvaluationFixture;
  candidates: OnsetCandidate[];
  metrics: OnsetEvaluationMetrics;
}
