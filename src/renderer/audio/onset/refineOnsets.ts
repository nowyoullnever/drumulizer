import { MAX_SLICE_MARKERS, MIN_SLICE_DURATION_MS } from '../../../shared/constants/slice';
import type { OnsetBand, OnsetCandidate } from './onsetTypes';

export const refineOnsetSample = (
  monoData: Float32Array,
  sampleRate: number,
  coarseSample: number,
): number => {
  const searchRadius = Math.max(1, Math.round((sampleRate * 12) / 1000));
  const preAttack = Math.max(0, Math.round((sampleRate * 2) / 1000));
  const start = Math.max(1, coarseSample - searchRadius);
  const end = Math.min(monoData.length - 1, coarseSample + searchRadius);
  let bestSample = coarseSample;
  let bestScore = -Infinity;

  for (let sample = start; sample <= end; sample += 1) {
    const derivative = Math.abs((monoData[sample] ?? 0) - (monoData[sample - 1] ?? 0));
    const localEnergy =
      Math.abs(monoData[sample] ?? 0) +
      Math.abs(monoData[Math.min(monoData.length - 1, sample + 1)] ?? 0);
    const score = derivative + localEnergy * 0.25;
    if (score > bestScore) {
      bestScore = score;
      bestSample = sample;
    }
  }

  // Shift slightly earlier so an applied marker preserves the attack transient.
  return Math.max(1, Math.min(monoData.length - 2, bestSample - preAttack));
};

export const enforceCandidateRules = (
  candidates: OnsetCandidate[],
  sourceLengthSamples: number,
  sampleRate: number,
  minimumGapMs: number,
): { candidates: OnsetCandidate[]; capped: boolean } => {
  const minSliceSamples = Math.max(
    1,
    Math.ceil((sampleRate * Math.max(MIN_SLICE_DURATION_MS, minimumGapMs)) / 1000),
  );
  const strongestBySample = new Map<number, OnsetCandidate>();
  for (const candidate of candidates) {
    if (candidate.sampleIndex < minSliceSamples) continue;
    if (candidate.sampleIndex > sourceLengthSamples - minSliceSamples) continue;
    const existing = strongestBySample.get(candidate.sampleIndex);
    if (!existing || candidate.score > existing.score)
      strongestBySample.set(candidate.sampleIndex, candidate);
  }
  const sorted = [...strongestBySample.values()].sort(
    (left, right) => left.sampleIndex - right.sampleIndex || right.score - left.score,
  );
  const spaced: OnsetCandidate[] = [];
  for (const candidate of sorted) {
    const last = spaced.at(-1);
    if (!last || candidate.sampleIndex - last.sampleIndex >= minSliceSamples) {
      spaced.push(candidate);
      continue;
    }
    if (candidate.score > last.score) {
      spaced[spaced.length - 1] = candidate;
    }
  }
  if (spaced.length <= MAX_SLICE_MARKERS) {
    return { candidates: withStableIds(spaced), capped: false };
  }
  const strongest = [...spaced]
    .sort((left, right) => right.score - left.score || left.sampleIndex - right.sampleIndex)
    .slice(0, MAX_SLICE_MARKERS)
    .sort((left, right) => left.sampleIndex - right.sampleIndex);
  return { candidates: withStableIds(strongest), capped: true };
};

export const dominantBandForFrame = (
  values: Record<Exclude<OnsetBand, 'broadband'>, Float32Array>,
  frameIndex: number,
): OnsetBand => {
  let best: OnsetBand = 'broadband';
  let bestValue = 0;
  for (const band of Object.keys(values) as Exclude<OnsetBand, 'broadband'>[]) {
    const value = values[band][frameIndex] ?? 0;
    if (value > bestValue) {
      best = band;
      bestValue = value;
    }
  }
  return best;
};

const withStableIds = (candidates: OnsetCandidate[]): OnsetCandidate[] =>
  candidates.map((candidate, index) => ({
    ...candidate,
    id: `onset-${index + 1}-${candidate.sampleIndex.toString(36)}`,
  }));
