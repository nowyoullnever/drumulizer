import { MIN_SLICE_DURATION_MS } from '../../../shared/constants/slice';
import { sensitivityToThresholdMultiplier } from './adaptiveThreshold';

export interface PeakCandidate {
  frameIndex: number;
  score: number;
  prominence: number;
}

export const pickPeaks = (
  combined: Float32Array,
  sensitivity: number,
  minimumGapMs: number,
  sampleRate: number,
  hopSize: number,
): PeakCandidate[] => {
  const threshold = sensitivityToThresholdMultiplier(sensitivity);
  const peaks: PeakCandidate[] = [];
  for (let index = 1; index < combined.length - 1; index += 1) {
    const score = combined[index];
    if (!Number.isFinite(score) || score < threshold) continue;
    if (score < combined[index - 1] || score < combined[index + 1]) continue;
    const prominence = calculateProminence(combined, index, sampleRate, hopSize);
    peaks.push({ frameIndex: index, score, prominence });
  }
  return enforceMinimumFrameGap(
    peaks,
    Math.max(MIN_SLICE_DURATION_MS, minimumGapMs),
    sampleRate,
    hopSize,
  );
};

export const enforceMinimumFrameGap = (
  peaks: PeakCandidate[],
  minimumGapMs: number,
  sampleRate: number,
  hopSize: number,
): PeakCandidate[] => {
  const gapFrames = Math.max(1, Math.round((sampleRate * minimumGapMs) / 1000 / hopSize));
  const selected: PeakCandidate[] = [];
  for (const peak of peaks) {
    const last = selected.at(-1);
    if (!last || peak.frameIndex - last.frameIndex >= gapFrames) {
      selected.push(peak);
      continue;
    }
    if (peak.score + peak.prominence > last.score + last.prominence) {
      selected[selected.length - 1] = peak;
    }
  }
  return selected;
};

export const calculateProminence = (
  values: Float32Array,
  frameIndex: number,
  sampleRate: number,
  hopSize: number,
  neighborhoodMs = 80,
): number => {
  const radius = Math.max(1, Math.round((sampleRate * neighborhoodMs) / 1000 / hopSize));
  let localMinimum = Number.POSITIVE_INFINITY;
  for (
    let index = Math.max(0, frameIndex - radius);
    index <= Math.min(values.length - 1, frameIndex + radius);
    index += 1
  ) {
    if (index === frameIndex) continue;
    localMinimum = Math.min(localMinimum, values[index]);
  }
  return Math.max(0, values[frameIndex] - (Number.isFinite(localMinimum) ? localMinimum : 0));
};
