import type { SliceRegion } from '../../../slice/types';

export interface SliceAnalysisFixture {
  name: string;
  samples: Float32Array;
  sampleRate: number;
  slices: SliceRegion[];
  expectedDominantRole: 'low' | 'mid' | 'high' | 'texture' | 'unclassified';
}

const sampleRate = 24000;
const sliceLength = Math.round(sampleRate * 0.18);

export const generateSliceAnalysisFixtures = (): SliceAnalysisFixture[] => [
  fixture('sub drop', 'low', (samples) => addDecayingSine(samples, 0, 56, 0.92, 0.12)),
  fixture('round low body', 'low', (samples) => addDecayingSine(samples, 0, 112, 0.75, 0.1)),
  fixture('short low punch', 'low', (samples) => addDecayingSine(samples, 0, 86, 0.8, 0.055)),
  fixture('mid tom body', 'mid', (samples) => addDecayingSine(samples, 0, 330, 0.7, 0.09)),
  fixture('snare crack', 'mid', (samples) => {
    addNoiseBurst(samples, 0, 0.7, 0.045);
    addDecayingSine(samples, 0, 210, 0.35, 0.08);
  }),
  fixture('clap body', 'mid', (samples) => addNoiseBurst(samples, 0.012, 0.68, 0.07)),
  fixture('rim tick', 'high', (samples) => addImpulse(samples, 0.006, 0.72)),
  fixture('bright click', 'high', (samples) => addDecayingSine(samples, 0, 7200, 0.5, 0.02)),
  fixture('closed hat', 'high', (samples) => addNoiseBurst(samples, 0, 0.46, 0.025)),
  fixture('air hiss', 'texture', (samples) => addNoiseBurst(samples, 0, 0.18, 0.16)),
  fixture('long noisy tail', 'texture', (samples) => addNoiseBurst(samples, 0, 0.22, 0.18)),
  fixture('granular texture', 'texture', (samples) => {
    for (let index = 0; index < 8; index += 1) addImpulse(samples, index * 0.019, 0.24);
  }),
  fixture('tonal high tail', 'texture', (samples) => addDecayingSine(samples, 0, 1900, 0.34, 0.17)),
  fixture('hybrid low crack', 'mid', (samples) => {
    addDecayingSine(samples, 0, 96, 0.45, 0.09);
    addImpulse(samples, 0.002, 0.55);
  }),
  fixture('soft body', 'mid', (samples) => addDecayingSine(samples, 0, 420, 0.28, 0.12)),
  fixture('quiet high click', 'high', (samples) => addImpulse(samples, 0.004, 0.22)),
  fixture('nearly silent', 'unclassified', () => undefined),
  fixture('dc contaminated low', 'low', (samples) => {
    addDecayingSine(samples, 0, 72, 0.55, 0.1);
    for (let index = 0; index < samples.length; index += 1) samples[index] += 0.015;
  }),
  fixture('clipped crack warning', 'mid', (samples) => {
    addImpulse(samples, 0.005, 1.4);
    addNoiseBurst(samples, 0.006, 0.65, 0.05);
  }),
];

const fixture = (
  name: string,
  expectedDominantRole: SliceAnalysisFixture['expectedDominantRole'],
  draw: (samples: Float32Array) => void | undefined,
): SliceAnalysisFixture => {
  const samples = new Float32Array(sliceLength);
  draw(samples);
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (peak > 1) {
    for (let index = 0; index < samples.length; index += 1)
      samples[index] = Math.max(-1, Math.min(1, samples[index]));
  }
  return {
    name,
    samples,
    sampleRate,
    expectedDominantRole,
    slices: [
      {
        id: `${name}-slice`,
        index: 0,
        startSample: 0,
        endSample: samples.length,
        durationSamples: samples.length,
        startSeconds: 0,
        endSeconds: samples.length / sampleRate,
        durationSeconds: samples.length / sampleRate,
        leftBoundaryId: 'source-start',
        rightBoundaryId: 'source-end',
      },
    ],
  };
};

const addImpulse = (samples: Float32Array, second: number, gain: number): void => {
  const position = Math.round(second * sampleRate);
  if (position + 3 >= samples.length) return;
  samples[position] += 0.95 * gain;
  samples[position + 1] -= 0.55 * gain;
  samples[position + 2] += 0.25 * gain;
};

const addDecayingSine = (
  samples: Float32Array,
  second: number,
  frequency: number,
  gain: number,
  decaySeconds: number,
): void => {
  const start = Math.round(second * sampleRate);
  for (let offset = 0; start + offset < samples.length; offset += 1) {
    samples[start + offset] +=
      Math.sin((2 * Math.PI * frequency * offset) / sampleRate) *
      Math.exp(-offset / Math.max(1, sampleRate * decaySeconds)) *
      gain;
  }
};

const addNoiseBurst = (
  samples: Float32Array,
  second: number,
  gain: number,
  decaySeconds: number,
): void => {
  const start = Math.round(second * sampleRate);
  for (let offset = 0; start + offset < samples.length; offset += 1) {
    const pseudo = (((offset * 48271 + 17) % 2147483647) / 1073741824 - 1) * 0.5;
    samples[start + offset] +=
      pseudo * Math.exp(-offset / Math.max(1, sampleRate * decaySeconds)) * gain;
  }
};
