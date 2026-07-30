import { fftRadix2, positiveMagnitudes, createHannWindow } from './fft';
import type { OnsetBand } from './onsetTypes';

export const BAND_RANGES: Record<Exclude<OnsetBand, 'broadband'>, [number, number]> = {
  low: [20, 160],
  'low-mid': [160, 800],
  'high-mid': [800, 4000],
  high: [4000, 12000],
};

const BAND_ORDER = ['low', 'low-mid', 'high-mid', 'high'] as const;
const LOG_MAGNITUDE_SCALE = 24;
const MINIMUM_BAND_ENERGY_RATIO = 0.0002;

export interface NoveltyCurves {
  bandFlux: Record<Exclude<OnsetBand, 'broadband'>, Float32Array>;
  energyRise: Float32Array;
  highFrequencyNovelty: Float32Array;
  frameCount: number;
}

export const analyzeSpectralFlux = (
  samples: Float32Array,
  sampleRate: number,
  frameSize: number,
  hopSize: number,
): NoveltyCurves => {
  const frameCount = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);
  const bandFlux = Object.fromEntries(
    Object.keys(BAND_RANGES).map((band) => [band, new Float32Array(frameCount)]),
  ) as NoveltyCurves['bandFlux'];
  const energyRise = new Float32Array(frameCount);
  const highFrequencyNovelty = new Float32Array(frameCount);
  const previousMagnitudes = new Float32Array(frameSize / 2 + 1);
  const magnitudes = new Float32Array(frameSize / 2 + 1);
  const frameData = new Float32Array(frameSize);
  const window = createHannWindow(frameSize);
  const binRanges = BAND_ORDER.map(
    (band) => [band, binsForBand(BAND_RANGES[band], sampleRate, frameSize)] as const,
  );
  const frequencyWeights = Float32Array.from({ length: frameSize / 2 + 1 }, (_, bin) => {
    const frequency = (bin * sampleRate) / frameSize;
    return frequency / Math.max(1, sampleRate / 2);
  });
  let globalReferenceEnergy = 0;
  for (let index = 0; index < samples.length; index += 1)
    globalReferenceEnergy += samples[index] * samples[index];
  globalReferenceEnergy = Math.sqrt(globalReferenceEnergy / Math.max(1, samples.length));
  let previousRms = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * hopSize;
    let energy = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const value = (samples[offset + index] ?? 0) * window[index];
      frameData[index] = value;
      energy += value * value;
    }
    const rms = Math.sqrt(energy / frameSize);
    energyRise[frame] = Math.max(0, rms - previousRms) / (previousRms + 0.000001);
    previousRms = rms;

    magnitudes.set(positiveMagnitudes(fftRadix2(frameData)));
    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      magnitudes[bin] = Math.log1p(LOG_MAGNITUDE_SCALE * magnitudes[bin]);
    }

    for (const [band, [startBin, endBin]] of binRanges) {
      let flux = 0;
      let bandEnergy = 0;
      for (let bin = startBin; bin <= endBin; bin += 1) {
        const magnitude = magnitudes[bin] ?? 0;
        flux += Math.max(0, magnitude - previousMagnitudes[bin]);
        bandEnergy += magnitude;
      }
      const binCount = Math.max(1, endBin - startBin + 1);
      const energyFloor = Math.max(
        0.00001,
        globalReferenceEnergy * LOG_MAGNITUDE_SCALE * MINIMUM_BAND_ENERGY_RATIO * binCount,
      );
      bandFlux[band][frame] = endBin >= startBin ? flux / Math.max(bandEnergy, energyFloor) : 0;
    }

    let weighted = 0;
    let weightSum = 0;
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      const weight = frequencyWeights[bin];
      weighted += Math.max(0, magnitudes[bin] - previousMagnitudes[bin]) * weight;
      weightSum += weight;
    }
    highFrequencyNovelty[frame] = weighted / (weightSum + 0.000001);
    previousMagnitudes.set(magnitudes);
  }

  return { bandFlux, energyRise, highFrequencyNovelty, frameCount };
};

export const binsForBand = (
  [lowHz, highHz]: [number, number],
  sampleRate: number,
  frameSize: number,
): [number, number] => {
  const nyquist = sampleRate / 2;
  const clampedLow = Math.max(0, Math.min(nyquist, lowHz));
  const clampedHigh = Math.max(0, Math.min(nyquist, highHz));
  if (clampedHigh <= clampedLow) return [1, 0];
  return [
    Math.max(1, Math.ceil((clampedLow * frameSize) / sampleRate)),
    Math.min(frameSize / 2, Math.floor((clampedHigh * frameSize) / sampleRate)),
  ];
};
