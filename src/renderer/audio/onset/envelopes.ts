export interface EnvelopeFeatures {
  fastRise: Float32Array;
  slowContrast: Float32Array;
  lowEnvelopeRise: Float32Array;
}

export const calculateEnvelopeFeatures = (
  samples: Float32Array,
  sampleRate: number,
  frameCount: number,
  hopSize: number,
): EnvelopeFeatures => {
  const fast = smoothAbsoluteEnvelope(samples, sampleRate, 8);
  const slow = smoothAbsoluteEnvelope(samples, sampleRate, 90);
  const low = smoothAbsoluteEnvelope(lowPassOnePole(samples, sampleRate, 220), sampleRate, 18);
  const fastRise = new Float32Array(frameCount);
  const slowContrast = new Float32Array(frameCount);
  const lowEnvelopeRise = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const sample = Math.min(samples.length - 1, frame * hopSize);
    const previous = Math.max(0, sample - hopSize);
    fastRise[frame] = Math.max(0, fast[sample] - fast[previous]) / (slow[sample] + 0.00001);
    slowContrast[frame] = Math.max(0, fast[sample] - slow[sample]) / (slow[sample] + 0.00001);
    lowEnvelopeRise[frame] = Math.max(0, low[sample] - low[previous]) / (low[previous] + 0.0001);
  }

  return { fastRise, slowContrast, lowEnvelopeRise };
};

const smoothAbsoluteEnvelope = (
  samples: Float32Array,
  sampleRate: number,
  timeMs: number,
): Float32Array => {
  const output = new Float32Array(samples.length);
  const coefficient = Math.exp(-1 / Math.max(1, (sampleRate * timeMs) / 1000));
  let state = Math.abs(samples[0] ?? 0);
  output[0] = state;
  for (let index = 1; index < samples.length; index += 1) {
    const target = Math.abs(samples[index]);
    state = target > state ? target : coefficient * state + (1 - coefficient) * target;
    output[index] = state;
  }
  return output;
};

const lowPassOnePole = (
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array => {
  const output = new Float32Array(samples.length);
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  let state = 0;
  for (let index = 0; index < samples.length; index += 1) {
    state += alpha * (samples[index] - state);
    output[index] = state;
  }
  return output;
};
