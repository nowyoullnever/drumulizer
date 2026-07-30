export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export const robustLocalNormalize = (
  values: Float32Array,
  sampleRate: number,
  hopSize: number,
  windowMs = 350,
): Float32Array => {
  const radius = Math.max(1, Math.round((sampleRate * windowMs) / 1000 / hopSize));
  const output = new Float32Array(values.length);

  for (let index = 0; index < values.length; index += 1) {
    const local: number[] = [];
    for (
      let localIndex = Math.max(0, index - radius);
      localIndex <= Math.min(values.length - 1, index + radius);
      localIndex += 1
    ) {
      const value = values[localIndex];
      if (Number.isFinite(value)) local.push(value);
    }
    const center = median(local);
    const deviation = median(local.map((value) => Math.abs(value - center)));
    output[index] = Math.max(0, (values[index] - center) / (deviation * 1.4826 + 0.000001));
  }

  return output;
};

export const sensitivityToThresholdMultiplier = (sensitivity: number): number => {
  const ratio = Math.max(0, Math.min(100, sensitivity)) / 100;
  return 3.2 + (0.9 - 3.2) * ratio;
};
