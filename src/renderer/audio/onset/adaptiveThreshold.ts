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
  const blockFrames = Math.max(4, Math.round((sampleRate * 125) / 1000 / hopSize));
  const smoothingBlocks = Math.max(1, Math.round(windowMs / 125));
  const blockCount = Math.max(1, Math.ceil(values.length / blockFrames));
  const centers = new Float32Array(blockCount);
  const spreads = new Float32Array(blockCount);
  const output = new Float32Array(values.length);

  for (let block = 0; block < blockCount; block += 1) {
    const start = block * blockFrames;
    const end = Math.min(values.length, start + blockFrames);
    const local: number[] = [];
    for (let index = start; index < end; index += 1) {
      if (Number.isFinite(values[index])) local.push(values[index]);
    }
    const center = median(local);
    centers[block] = center;
    spreads[block] = median(local.map((value) => Math.abs(value - center))) * 1.4826 + 0.000001;
  }

  for (let block = 0; block < blockCount; block += 1) {
    let centerSum = 0;
    let spreadSum = 0;
    let count = 0;
    for (
      let neighbor = Math.max(0, block - smoothingBlocks);
      neighbor <= Math.min(blockCount - 1, block + smoothingBlocks);
      neighbor += 1
    ) {
      centerSum += centers[neighbor];
      spreadSum += spreads[neighbor];
      count += 1;
    }
    const center = centerSum / count;
    const spread = spreadSum / count;
    const start = block * blockFrames;
    const end = Math.min(values.length, start + blockFrames);
    for (let index = start; index < end; index += 1) {
      const value = Number.isFinite(values[index]) ? values[index] : 0;
      output[index] = Math.max(0, (value - center) / spread);
    }
  }

  return output;
};

export const sensitivityToThresholdMultiplier = (sensitivity: number): number => {
  const ratio = Math.max(0, Math.min(100, sensitivity)) / 100;
  return 3.2 + (0.9 - 3.2) * ratio;
};
