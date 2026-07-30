import { MIN_SLICE_DURATION_MS } from '../../../shared/constants/slice';
import { sensitivityToThresholdMultiplier } from './adaptiveThreshold';

export interface PeakCandidate {
  frameIndex: number;
  score: number;
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
    peaks.push({ frameIndex: index, score });
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
    if (peak.score > last.score) {
      selected[selected.length - 1] = peak;
    }
  }
  return selected;
};
