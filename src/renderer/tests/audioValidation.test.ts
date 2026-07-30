import { describe, expect, it } from 'vitest';
import { MAX_AUDIO_FILE_BYTES } from '../../shared/constants/audio';
import { validateAudioFileInput } from '../audio/validation';

const bytes = new ArrayBuffer(8);

describe('audio file validation', () => {
  it('accepts WAV and MP3 files', () => {
    expect(validateAudioFileInput({ canceled: false, fileName: 'tone.wav', bytes })).toBeNull();
    expect(validateAudioFileInput({ canceled: false, fileName: 'beat.mp3', bytes })).toBeNull();
  });

  it('returns stable error codes for invalid files', () => {
    expect(validateAudioFileInput({ canceled: false, fileName: 'note.txt', bytes })).toBe(
      'UNSUPPORTED_EXTENSION',
    );
    expect(
      validateAudioFileInput({
        canceled: false,
        fileName: 'huge.wav',
        fileSizeBytes: MAX_AUDIO_FILE_BYTES + 1,
        bytes,
      }),
    ).toBe('FILE_TOO_LARGE');
    expect(validateAudioFileInput({ canceled: false, fileName: 'empty.wav' })).toBe('EMPTY_FILE');
  });

  it('treats dialog cancel as non-error', () => {
    expect(validateAudioFileInput({ canceled: true })).toBeNull();
  });
});
