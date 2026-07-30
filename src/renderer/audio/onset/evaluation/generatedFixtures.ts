import type { OnsetEvaluationFixture } from './evaluationTypes';

const sampleRate = 24000;
const oneSecond = sampleRate;

export const generateOnsetEvaluationFixtures = (): OnsetEvaluationFixture[] => [
  impulseFixture('isolated impulse', [0.25]),
  impulseFixture('repeated impulse train', [0.15, 0.35, 0.55, 0.75]),
  kickFixture(),
  noiseBurstFixture(),
  highClickFixture(),
  alternatingFixture(),
  quietTransientOverNoise(),
  gainPattern(0.25),
  gainPattern(0.7),
  gainPattern(1.4),
  sustainedSine(),
  gradualRamp(),
  repeatedSlowSwells(),
  attackOverRamp(),
  densePolyphonic(),
  impulseFixture('close attacks', [0.25, 0.296, 0.55]),
  silence(),
  dcOffset(),
  nonFinite(),
];

const impulseFixture = (name: string, seconds: number[], gain = 1): OnsetEvaluationFixture => {
  const samples = new Float32Array(oneSecond);
  for (const second of seconds) addImpulse(samples, Math.round(second * sampleRate), gain);
  return { name, samples, sampleRate, expectedSeconds: seconds };
};

const kickFixture = (): OnsetEvaluationFixture => {
  const samples = new Float32Array(oneSecond);
  const expected = [0.2, 0.5, 0.8];
  for (const second of expected) addDecayingSine(samples, second, 80, 0.9);
  return { name: 'kick-like decaying sine bursts', samples, sampleRate, expectedSeconds: expected };
};

const noiseBurstFixture = (): OnsetEvaluationFixture => {
  const samples = new Float32Array(oneSecond);
  const expected = [0.22, 0.52, 0.82];
  for (const second of expected) addNoiseBurst(samples, second, 0.8);
  return {
    name: 'snare-like filtered noise bursts',
    samples,
    sampleRate,
    expectedSeconds: expected,
  };
};

const highClickFixture = (): OnsetEvaluationFixture =>
  impulseFixture('high-frequency clicks', [0.18, 0.42, 0.66, 0.9], 0.65);

const alternatingFixture = (): OnsetEvaluationFixture => {
  const samples = new Float32Array(oneSecond);
  addDecayingSine(samples, 0.2, 90, 0.8);
  addImpulse(samples, Math.round(0.4 * sampleRate), 0.7);
  addDecayingSine(samples, 0.6, 110, 0.8);
  addImpulse(samples, Math.round(0.8 * sampleRate), 0.7);
  return {
    name: 'alternating low and high attacks',
    samples,
    sampleRate,
    expectedSeconds: [0.2, 0.4, 0.6, 0.8],
  };
};

const quietTransientOverNoise = (): OnsetEvaluationFixture => {
  const samples = lowNoise(1, 0.015);
  [0.25, 0.5, 0.75].forEach((second) => addImpulse(samples, Math.round(second * sampleRate), 0.16));
  return {
    name: 'quiet transients over low noise',
    samples,
    sampleRate,
    expectedSeconds: [0.25, 0.5, 0.75],
  };
};

const gainPattern = (gain: number): OnsetEvaluationFixture =>
  impulseFixture(`gain pattern ${gain}`, [0.2, 0.45, 0.7], gain);

const sustainedSine = (): OnsetEvaluationFixture => ({
  name: 'sustained sine',
  samples: Float32Array.from(
    { length: oneSecond },
    (_, index) => Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.25,
  ),
  sampleRate,
  expectedSeconds: [],
  maxCandidates: 1,
});

const gradualRamp = (): OnsetEvaluationFixture => ({
  name: 'gradual ramp',
  samples: Float32Array.from(
    { length: oneSecond },
    (_, index) => Math.sin((2 * Math.PI * 220 * index) / sampleRate) * (index / oneSecond) * 0.5,
  ),
  sampleRate,
  expectedSeconds: [],
  maxCandidates: 1,
});

const repeatedSlowSwells = (): OnsetEvaluationFixture => ({
  name: 'repeated slow swells',
  samples: Float32Array.from({ length: oneSecond * 2 }, (_, index) => {
    const phase = (index % (sampleRate / 2)) / (sampleRate / 2);
    return Math.sin((2 * Math.PI * 180 * index) / sampleRate) * Math.sin(Math.PI * phase) * 0.35;
  }),
  sampleRate,
  expectedSeconds: [],
  maxCandidates: 4,
});

const attackOverRamp = (): OnsetEvaluationFixture => {
  const fixture = gradualRamp();
  addImpulse(fixture.samples, Math.round(0.62 * sampleRate), 0.8);
  return {
    ...fixture,
    name: 'sharp attack over gradual ramp',
    expectedSeconds: [0.62],
    maxCandidates: 3,
  };
};

const densePolyphonic = (): OnsetEvaluationFixture => {
  const samples = Float32Array.from(
    { length: oneSecond },
    (_, index) =>
      (Math.sin((2 * Math.PI * 220 * index) / sampleRate) +
        Math.sin((2 * Math.PI * 330 * index) / sampleRate) +
        Math.sin((2 * Math.PI * 660 * index) / sampleRate)) *
      0.12,
  );
  [0.3, 0.65].forEach((second) => addImpulse(samples, Math.round(second * sampleRate), 0.9));
  return {
    name: 'dense polyphonic synthetic material',
    samples,
    sampleRate,
    expectedSeconds: [0.3, 0.65],
    maxCandidates: 8,
  };
};

const silence = (): OnsetEvaluationFixture => ({
  name: 'silence',
  samples: new Float32Array(oneSecond),
  sampleRate,
  expectedSeconds: [],
  maxCandidates: 0,
});
const dcOffset = (): OnsetEvaluationFixture => {
  const fixture = impulseFixture('DC offset input', [0.45]);
  for (let index = 0; index < fixture.samples.length; index += 1) fixture.samples[index] += 0.2;
  return fixture;
};
const nonFinite = (): OnsetEvaluationFixture => {
  const fixture = impulseFixture('non-finite input', [0.45]);
  fixture.samples[100] = Number.NaN;
  fixture.samples[101] = Number.POSITIVE_INFINITY;
  return fixture;
};

const addImpulse = (samples: Float32Array, position: number, gain: number): void => {
  if (position < 0 || position + 2 >= samples.length) return;
  samples[position] += 0.9 * gain;
  samples[position + 1] -= 0.55 * gain;
  samples[position + 2] += 0.2 * gain;
};

const addDecayingSine = (
  samples: Float32Array,
  second: number,
  frequency: number,
  gain: number,
): void => {
  const start = Math.round(second * sampleRate);
  const length = Math.round(0.12 * sampleRate);
  for (let offset = 0; offset < length && start + offset < samples.length; offset += 1) {
    samples[start + offset] +=
      Math.sin((2 * Math.PI * frequency * offset) / sampleRate) *
      Math.exp(-offset / (sampleRate * 0.035)) *
      gain;
  }
};

const addNoiseBurst = (samples: Float32Array, second: number, gain: number): void => {
  const start = Math.round(second * sampleRate);
  for (let offset = 0; offset < 400 && start + offset < samples.length; offset += 1) {
    const pseudo = (((offset * 1103515245 + 12345) >>> 8) % 65536) / 32768 - 1;
    samples[start + offset] += pseudo * Math.exp(-offset / 160) * gain;
  }
};

const lowNoise = (seconds: number, gain: number): Float32Array =>
  Float32Array.from(
    { length: Math.round(seconds * sampleRate) },
    (_, index) => (((index * 16807) % 2147483647) / 1073741824 - 1) * gain,
  );
