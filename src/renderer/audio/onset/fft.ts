export interface ComplexSpectrum {
  real: Float32Array;
  imag: Float32Array;
}

export const isPowerOfTwo = (value: number): boolean => value > 0 && (value & (value - 1)) === 0;

export const createHannWindow = (size: number): Float32Array => {
  const window = new Float32Array(size);
  if (size <= 1) return window;
  for (let index = 0; index < size; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
  }
  return window;
};

export const fftRadix2 = (input: Float32Array): ComplexSpectrum => {
  const size = input.length;
  if (!isPowerOfTwo(size)) throw new Error('FFT input length must be a power of two.');

  const real = new Float32Array(input);
  const imag = new Float32Array(size);

  for (let index = 1, reverse = 0; index < size; index += 1) {
    let bit = size >> 1;
    for (; reverse & bit; bit >>= 1) reverse ^= bit;
    reverse ^= bit;
    if (index < reverse) {
      [real[index], real[reverse]] = [real[reverse], real[index]];
      [imag[index], imag[reverse]] = [imag[reverse], imag[index]];
    }
  }

  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let wr = 1;
      let wi = 0;
      for (let offset = 0; offset < length / 2; offset += 1) {
        const even = start + offset;
        const odd = even + length / 2;
        const tr = wr * real[odd] - wi * imag[odd];
        const ti = wr * imag[odd] + wi * real[odd];
        real[odd] = real[even] - tr;
        imag[odd] = imag[even] - ti;
        real[even] += tr;
        imag[even] += ti;
        const nextWr = wr * stepReal - wi * stepImag;
        wi = wr * stepImag + wi * stepReal;
        wr = nextWr;
      }
    }
  }

  return { real, imag };
};

export const positiveMagnitudes = (spectrum: ComplexSpectrum): Float32Array => {
  const bins = spectrum.real.length / 2 + 1;
  const magnitudes = new Float32Array(bins);
  for (let index = 0; index < bins; index += 1) {
    magnitudes[index] = Math.hypot(spectrum.real[index], spectrum.imag[index]);
  }
  return magnitudes;
};
