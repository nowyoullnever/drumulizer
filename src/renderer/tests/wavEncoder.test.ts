import { describe, expect, it } from 'vitest';
import { encodeStereoWav } from '../export/wavEncoder';

describe('wav encoder', () => {
  it('writes deterministic stereo PCM headers for 16-bit and 24-bit output', () => {
    const left = new Float32Array([0, 1, -1]);
    const right = new Float32Array([0.5, -0.5, 2]);
    const wav16 = new Uint8Array(
      encodeStereoWav(left, right, { sampleRate: 48000, bitDepth: 16 }).bytes,
    );
    const wav24 = new Uint8Array(
      encodeStereoWav(left, right, { sampleRate: 44100, bitDepth: 24 }).bytes,
    );
    expect(String.fromCharCode(...wav16.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav16.slice(8, 12))).toBe('WAVE');
    expect(new DataView(wav16.buffer).getUint16(34, true)).toBe(16);
    expect(new DataView(wav24.buffer).getUint16(34, true)).toBe(24);
    expect([...wav16]).toEqual([
      ...new Uint8Array(encodeStereoWav(left, right, { sampleRate: 48000, bitDepth: 16 }).bytes),
    ]);
  });
});
