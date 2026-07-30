import { fftRadix2, positiveMagnitudes, createHannWindow } from './fft';
import type { OnsetBand } from './onsetTypes';

export const BAND_RANGES: Record<Exclude<OnsetBand, 'broadband'>, [number, number]> = {
  low: [20, 160],
  'low-mid': [160, 800],
  'high-mid': [800, 4000],
  high: [4000, 12000],
};

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
  const window = createHannWindow(frameSize);
  let previousRms = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * hopSize;
    const frameData = new Float32Array(frameSize);
    let energy = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const value = (samples[offset + index] ?? 0) * window[index];
      frameData[index] = value;
      energy += value * value;
    }
    const rms = Math.sqrt(energy / frameSize);
    energyRise[frame] = Math.max(0, rms - previousRms) / (previousRms + 0.000001);
    previousRms = rms;

    const magnitudes = positiveMagnitudes(fftRadix2(frameData));
    for (const band of Object.keys(BAND_RANGES) as Exclude<OnsetBand, 'broadband'>[]) {
      const [startBin, endBin] = binsForBand(BAND_RANGES[band], sampleRate, frameSize);
      let flux = 0;
      let bandEnergy = 0;
      for (let bin = startBin; bin <= endBin; bin += 1) {
        const magnitude = magnitudes[bin] ?? 0;
        flux += Math.max(0, magnitude - previousMagnitudes[bin]);
        bandEnergy += magnitude;
      }
      bandFlux[band][frame] = endBin >= startBin ? flux / (bandEnergy + 0.000001) : 0;
    }

    let weighted = 0;
    let weightSum = 0;
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      const frequency = (bin * sampleRate) / frameSize;
      const weight = frequency / Math.max(1, sampleRate / 2);
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
