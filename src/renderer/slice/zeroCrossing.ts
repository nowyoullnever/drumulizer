import { ZERO_CROSSING_SEARCH_MS } from '../../shared/constants/slice';

interface SnapToZeroCrossingInput {
  requestedSample: number;
  sampleRate: number;
  sourceLengthSamples: number;
  analysisMonoData?: Float32Array;
}

const hasSignChange = (left: number, right: number): boolean =>
  (left <= 0 && right >= 0) || (left >= 0 && right <= 0);

const candidateScore = (data: Float32Array, index: number, requestedSample: number): number => {
  const left = Math.abs(data[Math.max(0, index - 1)] ?? 0);
  const center = Math.abs(data[index] ?? 0);
  const right = Math.abs(data[Math.min(data.length - 1, index + 1)] ?? 0);
  return Math.abs(index - requestedSample) * 10 + left + center + right;
};

export const snapToZeroCrossing = ({
  requestedSample,
  sampleRate,
  sourceLengthSamples,
  analysisMonoData,
}: SnapToZeroCrossingInput): number => {
  if (!analysisMonoData || analysisMonoData.length === 0 || sampleRate <= 0) {
    return requestedSample;
  }

  const searchSamples = Math.max(1, Math.round((sampleRate * ZERO_CROSSING_SEARCH_MS) / 1000));
  const center = Math.max(0, Math.min(sourceLengthSamples, Math.round(requestedSample)));
  const start = Math.max(1, center - searchSamples);
  const end = Math.min(analysisMonoData.length - 1, center + searchSamples);
  let bestCrossing: number | null = null;
  let bestCrossingScore = Number.POSITIVE_INFINITY;

  for (let index = start; index <= end; index += 1) {
    if (!hasSignChange(analysisMonoData[index - 1] ?? 0, analysisMonoData[index] ?? 0)) continue;
    const score = candidateScore(analysisMonoData, index, center);
    if (score < bestCrossingScore) {
      bestCrossing = index;
      bestCrossingScore = score;
    }
  }

  if (bestCrossing !== null) return bestCrossing;

  let bestLowAmplitude = center;
  let bestAmplitudeScore = Number.POSITIVE_INFINITY;
  for (let index = start; index <= end; index += 1) {
    const score = Math.abs(analysisMonoData[index] ?? 0) + Math.abs(index - center) / searchSamples;
    if (score < bestAmplitudeScore) {
      bestLowAmplitude = index;
      bestAmplitudeScore = score;
    }
  }

  return bestLowAmplitude;
};
