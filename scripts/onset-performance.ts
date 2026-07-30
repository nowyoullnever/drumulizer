import { performance } from 'node:perf_hooks';
import { detectOnsets } from '../src/renderer/audio/onset/detectOnsets';
import type { OnsetAnalysisResult } from '../src/renderer/audio/onset/onsetTypes';

const sampleRate = 24000;

const createSyntheticLoop = (seconds: number): Float32Array => {
  const samples = new Float32Array(seconds * sampleRate);
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    const tonal =
      Math.sin(2 * Math.PI * 90 * time) * 0.08 +
      Math.sin(2 * Math.PI * 180 * time) * 0.04 +
      Math.sin(2 * Math.PI * 720 * time) * 0.02;
    const beatPhase = time % 0.5;
    const transient = beatPhase < 0.012 ? Math.exp(-beatPhase / 0.004) * 0.8 : 0;
    samples[index] = tonal + (index % 2 === 0 ? transient : -transient * 0.55);
  }
  return samples;
};

const runCase = (seconds: number): { result: OnsetAnalysisResult; elapsedMs: number } => {
  const samples = createSyntheticLoop(seconds);
  const started = performance.now();
  const result = detectOnsets({
    requestId: `perf-${seconds}`,
    monoData: samples,
    originalSampleRate: sampleRate,
    settings: { sensitivity: 55, minimumGapMs: 45 },
  });
  return { result, elapsedMs: performance.now() - started };
};

for (const seconds of [30, 300]) {
  const { result, elapsedMs } = runCase(seconds);
  console.log(
    [
      `source=${seconds}s`,
      `sampleRate=${sampleRate}`,
      `frames=${result.diagnostics.frameCount}`,
      `candidates=${result.candidates.length}`,
      `elapsedMs=${elapsedMs.toFixed(1)}`,
      `workerResponsive=not-applicable-direct-helper`,
    ].join(' '),
  );
}
