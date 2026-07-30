import { createHannWindow, fftRadix2, positiveMagnitudes } from '../onset/fft';
import type { SliceRegion } from '../../slice/types';
import type { SliceRawFeatures } from './sliceAnalysisTypes';

const EPSILON = 0.000001;
const FRAME_SIZE = 1024;
const HOP_SIZE = 256;

const toDb = (value: number): number => 20 * Math.log10(Math.max(EPSILON, value));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const emptySliceFeatures = (durationMs = 0): SliceRawFeatures => ({
  durationMs,
  rmsDb: -120,
  peakDb: -120,
  crestFactor: 0,
  clippingRatio: 0,
  zeroCrossingRate: 0,
  attackMs: 0,
  decayMs: 0,
  earlyEnergyRatio: 0,
  tailEnergyRatio: 0,
  transientStrength: 0,
  subEnergyRatio: 0,
  lowMidEnergyRatio: 0,
  highMidEnergyRatio: 0,
  highEnergyRatio: 0,
  spectralCentroidHz: 0,
  spectralRolloffHz: 0,
  spectralFlatness: 0,
  spectralEntropy: 0,
  spectralFluxMean: 0,
  spectralFluxPeak: 0,
  highFrequencyContent: 0,
  pitchSalience: 0,
});

export const extractSliceFeatures = (
  monoData: Float32Array,
  sampleRate: number,
  slice: SliceRegion,
): SliceRawFeatures => {
  const start = Math.max(0, Math.min(monoData.length, slice.startSample));
  const end = Math.max(start, Math.min(monoData.length, slice.endSample));
  const length = end - start;
  const durationMs = (length / Math.max(1, sampleRate)) * 1000;
  if (length <= 1) return emptySliceFeatures(durationMs);

  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let zeroCrossings = 0;
  let previous = monoData[start] ?? 0;
  for (let index = start; index < end; index += 1) {
    const value = Number.isFinite(monoData[index]) ? monoData[index] : 0;
    const absolute = Math.abs(value);
    peak = Math.max(peak, absolute);
    sumSquares += value * value;
    if (absolute >= 0.999) clipped += 1;
    if ((previous < 0 && value >= 0) || (previous >= 0 && value < 0)) zeroCrossings += 1;
    previous = value;
  }

  const rms = Math.sqrt(sumSquares / length);
  const envelope = buildEnvelope(monoData, start, end, sampleRate);
  const spectral = analyzeSpectrum(monoData, start, end, sampleRate);
  const firstWindow = energyInRange(
    monoData,
    start,
    Math.min(end, start + Math.round(length * 0.18)),
  );
  const tailWindow = energyInRange(monoData, Math.max(start, end - Math.round(length * 0.35)), end);

  return {
    durationMs,
    rmsDb: toDb(rms),
    peakDb: toDb(peak),
    crestFactor: peak / (rms + EPSILON),
    clippingRatio: clipped / length,
    zeroCrossingRate: zeroCrossings / Math.max(1, length - 1),
    attackMs: envelope.attackMs,
    decayMs: envelope.decayMs,
    earlyEnergyRatio: firstWindow / (sumSquares + EPSILON),
    tailEnergyRatio: tailWindow / (sumSquares + EPSILON),
    transientStrength: envelope.transientStrength,
    ...spectral,
  };
};

const buildEnvelope = (
  monoData: Float32Array,
  start: number,
  end: number,
  sampleRate: number,
): { attackMs: number; decayMs: number; transientStrength: number } => {
  const windowSamples = Math.max(16, Math.round(sampleRate * 0.002));
  const frameCount = Math.max(1, Math.ceil((end - start) / windowSamples));
  const envelope = new Float32Array(frameCount);
  let peakFrame = 0;
  let peakValue = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameStart = start + frame * windowSamples;
    const frameEnd = Math.min(end, frameStart + windowSamples);
    let sum = 0;
    for (let index = frameStart; index < frameEnd; index += 1) {
      const value = Number.isFinite(monoData[index]) ? monoData[index] : 0;
      sum += value * value;
    }
    envelope[frame] = Math.sqrt(sum / Math.max(1, frameEnd - frameStart));
    if (envelope[frame] > peakValue) {
      peakValue = envelope[frame];
      peakFrame = frame;
    }
  }
  const threshold = peakValue * 0.2;
  const attackFrame = Math.max(
    0,
    envelope.findIndex((value) => value >= threshold),
  );
  let decayFrame = frameCount - 1;
  for (let frame = peakFrame; frame < frameCount; frame += 1) {
    if (envelope[frame] <= threshold) {
      decayFrame = frame;
      break;
    }
  }
  const early = envelope[0] ?? 0;
  const transientStrength =
    peakValue / (early + envelope[Math.min(frameCount - 1, peakFrame + 6)] + EPSILON);
  return {
    attackMs: ((peakFrame - attackFrame) * windowSamples * 1000) / sampleRate,
    decayMs: ((decayFrame - peakFrame) * windowSamples * 1000) / sampleRate,
    transientStrength,
  };
};

const energyInRange = (monoData: Float32Array, start: number, end: number): number => {
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    const value = Number.isFinite(monoData[index]) ? monoData[index] : 0;
    sum += value * value;
  }
  return sum;
};

const analyzeSpectrum = (
  monoData: Float32Array,
  start: number,
  end: number,
  sampleRate: number,
): Pick<
  SliceRawFeatures,
  | 'subEnergyRatio'
  | 'lowMidEnergyRatio'
  | 'highMidEnergyRatio'
  | 'highEnergyRatio'
  | 'spectralCentroidHz'
  | 'spectralRolloffHz'
  | 'spectralFlatness'
  | 'spectralEntropy'
  | 'spectralFluxMean'
  | 'spectralFluxPeak'
  | 'highFrequencyContent'
  | 'pitchSalience'
> => {
  const length = end - start;
  const frameCount = Math.max(1, Math.floor(Math.max(0, length - FRAME_SIZE) / HOP_SIZE) + 1);
  const window = createHannWindow(FRAME_SIZE);
  const frameData = new Float32Array(FRAME_SIZE);
  const previous = new Float32Array(FRAME_SIZE / 2 + 1);
  const aggregate = new Float32Array(FRAME_SIZE / 2 + 1);
  let totalMagnitude = 0;
  let fluxSum = 0;
  let fluxPeak = 0;
  let highContent = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = start + Math.min(Math.max(0, length - FRAME_SIZE), frame * HOP_SIZE);
    for (let index = 0; index < FRAME_SIZE; index += 1) {
      frameData[index] = (monoData[offset + index] ?? 0) * window[index];
    }
    const magnitudes = positiveMagnitudes(fftRadix2(frameData));
    let flux = 0;
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      const magnitude = magnitudes[bin];
      aggregate[bin] += magnitude;
      totalMagnitude += magnitude;
      flux += Math.max(0, magnitude - previous[bin]);
      highContent += magnitude * (bin / magnitudes.length);
    }
    fluxSum += flux / magnitudes.length;
    fluxPeak = Math.max(fluxPeak, flux / magnitudes.length);
    previous.set(magnitudes);
  }

  const band = (low: number, high: number): number => {
    const first = Math.max(1, Math.ceil((low * FRAME_SIZE) / sampleRate));
    const last = Math.min(aggregate.length - 1, Math.floor((high * FRAME_SIZE) / sampleRate));
    let sum = 0;
    for (let bin = first; bin <= last; bin += 1) sum += aggregate[bin];
    return sum;
  };
  const sub = band(20, 160);
  const lowMid = band(160, 800);
  const highMid = band(800, 4000);
  const high = band(4000, Math.min(12000, sampleRate / 2));
  const total = sub + lowMid + highMid + high + EPSILON;

  let centroidNumerator = 0;
  let geometric = 0;
  let entropy = 0;
  let maxMagnitude = 0;
  let cumulative = 0;
  let rolloffHz = 0;
  const rolloffTarget = totalMagnitude * 0.85;
  for (let bin = 1; bin < aggregate.length; bin += 1) {
    const magnitude = aggregate[bin];
    const frequency = (bin * sampleRate) / FRAME_SIZE;
    centroidNumerator += magnitude * frequency;
    geometric += Math.log(Math.max(EPSILON, magnitude));
    maxMagnitude = Math.max(maxMagnitude, magnitude);
    cumulative += magnitude;
    if (!rolloffHz && cumulative >= rolloffTarget) rolloffHz = frequency;
    const probability = magnitude / (totalMagnitude + EPSILON);
    if (probability > 0) entropy -= probability * Math.log2(probability);
  }
  const binCount = Math.max(1, aggregate.length - 1);
  return {
    subEnergyRatio: sub / total,
    lowMidEnergyRatio: lowMid / total,
    highMidEnergyRatio: highMid / total,
    highEnergyRatio: high / total,
    spectralCentroidHz: centroidNumerator / (totalMagnitude + EPSILON),
    spectralRolloffHz: rolloffHz,
    spectralFlatness: clamp01(
      Math.exp(geometric / binCount) / (totalMagnitude / binCount + EPSILON),
    ),
    spectralEntropy: clamp01(entropy / Math.log2(binCount)),
    spectralFluxMean: fluxSum / frameCount,
    spectralFluxPeak: fluxPeak,
    highFrequencyContent: highContent / ((totalMagnitude + EPSILON) * frameCount),
    pitchSalience: clamp01(maxMagnitude / (totalMagnitude / binCount + EPSILON) / 32),
  };
};
