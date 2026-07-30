import type { OnsetCandidate } from '../onsetTypes';
import type { OnsetEvaluationMetrics } from './evaluationTypes';

export const evaluateCandidates = (
  candidates: OnsetCandidate[],
  expectedSeconds: number[],
  durationSeconds: number,
  toleranceMs = 25,
): OnsetEvaluationMetrics => {
  const toleranceSeconds = toleranceMs / 1000;
  const used = new Set<number>();
  const errors: number[] = [];
  let truePositives = 0;

  for (const candidate of candidates) {
    let bestIndex = -1;
    let bestError = Number.POSITIVE_INFINITY;
    expectedSeconds.forEach((expected, index) => {
      if (used.has(index)) return;
      const error = Math.abs(candidate.timeSeconds - expected);
      if (error <= toleranceSeconds && error < bestError) {
        bestIndex = index;
        bestError = error;
      }
    });
    if (bestIndex >= 0) {
      used.add(bestIndex);
      truePositives += 1;
      errors.push(bestError * 1000);
    }
  }

  const falsePositives = candidates.length - truePositives;
  const falseNegatives = expectedSeconds.length - truePositives;
  const precision = truePositives / Math.max(1, truePositives + falsePositives);
  const recall = truePositives / Math.max(1, truePositives + falseNegatives);
  const f1 = (2 * precision * recall) / Math.max(0.000001, precision + recall);
  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    meanAbsoluteTimingErrorMs: errors.length
      ? errors.reduce((sum, value) => sum + value, 0) / errors.length
      : 0,
    maximumTimingErrorMs: errors.length ? Math.max(...errors) : 0,
    candidatesPerSecond: candidates.length / Math.max(0.001, durationSeconds),
  };
};
