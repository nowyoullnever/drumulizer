import { TARGET_ANALYSIS_SAMPLE_RATE } from './onsetTypes';

export interface PreprocessedOnsetData {
  samples: Float32Array;
  analysisSampleRate: number;
  sourceLengthSamples: number;
  analysisToSourceRatio: number;
  silent: boolean;
  frameSize: number;
  hopSize: number;
}

export const chooseFrameConfig = (sampleRate: number): { frameSize: number; hopSize: number } => {
  const targetWindowMs = 21.3;
  const targetHopMs = 5.3;
  const rawFrame = Math.max(64, Math.round((sampleRate * targetWindowMs) / 1000));
  const frameSize = 2 ** Math.ceil(Math.log2(rawFrame));
  const hopSize = Math.max(16, Math.round((sampleRate * targetHopMs) / 1000));
  return { frameSize, hopSize };
};

export const preprocessOnsetPcm = (
  monoData: Float32Array,
  originalSampleRate: number,
): PreprocessedOnsetData => {
  if (!Number.isFinite(originalSampleRate) || originalSampleRate <= 0 || monoData.length < 4) {
    return emptyPreprocess(originalSampleRate, monoData.length);
  }

  let mean = 0;
  let peak = 0;
  const finite = new Float32Array(monoData.length);
  for (let index = 0; index < monoData.length; index += 1) {
    const value = Number.isFinite(monoData[index]) ? monoData[index] : 0;
    finite[index] = value;
    mean += value;
  }
  mean /= Math.max(1, finite.length);

  for (let index = 0; index < finite.length; index += 1) {
    finite[index] -= mean;
    peak = Math.max(peak, Math.abs(finite[index]));
  }

  if (peak < 0.00001) {
    return { ...emptyPreprocess(originalSampleRate, monoData.length), silent: true };
  }

  const analysisSampleRate = Math.min(originalSampleRate, TARGET_ANALYSIS_SAMPLE_RATE);
  const samples =
    originalSampleRate > TARGET_ANALYSIS_SAMPLE_RATE
      ? downsampleByWindowAverage(finite, originalSampleRate, analysisSampleRate)
      : finite;
  const frame = chooseFrameConfig(analysisSampleRate);
  return {
    samples,
    analysisSampleRate,
    sourceLengthSamples: monoData.length,
    analysisToSourceRatio: originalSampleRate / analysisSampleRate,
    silent: false,
    ...frame,
  };
};

const emptyPreprocess = (
  sampleRate: number,
  sourceLengthSamples: number,
): PreprocessedOnsetData => {
  const safeRate =
    Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : TARGET_ANALYSIS_SAMPLE_RATE;
  return {
    samples: new Float32Array(0),
    analysisSampleRate: Math.min(safeRate, TARGET_ANALYSIS_SAMPLE_RATE),
    sourceLengthSamples,
    analysisToSourceRatio: 1,
    silent: true,
    ...chooseFrameConfig(Math.min(safeRate, TARGET_ANALYSIS_SAMPLE_RATE)),
  };
};

export const mapAnalysisSampleToSource = (
  analysisSample: number,
  analysisToSourceRatio: number,
  sourceLengthSamples: number,
): number =>
  Math.max(
    0,
    Math.min(sourceLengthSamples - 1, Math.round(analysisSample * analysisToSourceRatio)),
  );

const downsampleByWindowAverage = (
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array => {
  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let outIndex = 0; outIndex < outputLength; outIndex += 1) {
    const start = outIndex * ratio;
    const end = Math.min(input.length, (outIndex + 1) * ratio);
    const first = Math.floor(start);
    const last = Math.max(first + 1, Math.ceil(end));
    let sum = 0;
    let weightSum = 0;

    // Windowed averaging is a tiny low-pass-aware resampler for analysis only.
    for (let index = first; index < last; index += 1) {
      const left = Math.max(start, index);
      const right = Math.min(end, index + 1);
      const weight = Math.max(0, right - left);
      sum += input[index] * weight;
      weightSum += weight;
    }
    output[outIndex] = weightSum > 0 ? sum / weightSum : 0;
  }

  return output;
};
