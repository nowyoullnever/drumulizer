export interface WavEncodeOptions {
  sampleRate: number;
  bitDepth: 16 | 24;
}

export interface WavEncodeDiagnostics {
  clippedSamples: number;
  peak: number;
}

export interface EncodedWav {
  bytes: ArrayBuffer;
  diagnostics: WavEncodeDiagnostics;
}

const writeString = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

export const encodeStereoWav = (
  left: Float32Array,
  right: Float32Array,
  options: WavEncodeOptions,
): EncodedWav => {
  const sampleCount = Math.min(left.length, right.length);
  const bytesPerSample = options.bitDepth === 16 ? 2 : 3;
  const blockAlign = bytesPerSample * 2;
  const dataSize = sampleCount * blockAlign;
  if (dataSize > 0xffffffff - 44) throw new Error('WAV file is too large');
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, options.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, options.bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let clippedSamples = 0;
  let peak = 0;
  let offset = 44;
  const writeSample = (sample: number): void => {
    const finite = Number.isFinite(sample) ? sample : 0;
    peak = Math.max(peak, Math.abs(finite));
    const clamped = Math.max(-1, Math.min(1, finite));
    if (clamped !== finite) clippedSamples += 1;
    if (options.bitDepth === 16) {
      view.setInt16(offset, Math.round(clamped < 0 ? clamped * 32768 : clamped * 32767), true);
      offset += 2;
    } else {
      let value = Math.round(clamped < 0 ? clamped * 8388608 : clamped * 8388607);
      if (value < 0) value += 0x1000000;
      view.setUint8(offset, value & 0xff);
      view.setUint8(offset + 1, (value >> 8) & 0xff);
      view.setUint8(offset + 2, (value >> 16) & 0xff);
      offset += 3;
    }
  };
  for (let index = 0; index < sampleCount; index += 1) {
    writeSample(left[index]);
    writeSample(right[index]);
  }
  return { bytes: buffer, diagnostics: { clippedSamples, peak } };
};
