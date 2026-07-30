import type { ChannelWaveformPeaks, WaveformPeakLevel } from './types';

const PEAK_TARGETS = [1200, 3600, 9600];

export const buildPeakLevel = (
  samples: Float32Array,
  targetPeakCount: number,
): WaveformPeakLevel => {
  const samplesPerPeak = Math.max(1, Math.ceil(samples.length / targetPeakCount));
  const peakCount = Math.max(1, Math.ceil(samples.length / samplesPerPeak));
  const minimums = new Float32Array(peakCount);
  const maximums = new Float32Array(peakCount);

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const start = peakIndex * samplesPerPeak;
    const end = Math.min(samples.length, start + samplesPerPeak);
    let min = 0;
    let max = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const value = samples[sampleIndex];
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }

    minimums[peakIndex] = min;
    maximums[peakIndex] = max;
  }

  return { samplesPerPeak, minimums, maximums };
};

export const buildChannelPeaks = (
  channelData: Float32Array,
  channelIndex = 0,
): ChannelWaveformPeaks => ({
  channelIndex,
  levels: PEAK_TARGETS.map((target) => buildPeakLevel(channelData, target)),
});
