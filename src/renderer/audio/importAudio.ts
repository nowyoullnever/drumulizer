import { MAX_AUDIO_DURATION_SECONDS } from '../../shared/constants/audio';
import type {
  LocalAudioFileErrorCode,
  LocalAudioFileResult,
  SupportedAudioExtension,
} from '../../shared/types/app';
import { createAnalysisMonoData } from './mixdown';
import type { ImportedAudioRuntime } from './types';
import { extensionFromFileName, validateAudioFileInput } from './validation';

let audioContext: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  audioContext ??= new AudioContext();
  return audioContext;
};

export type AudioImportErrorCode =
  | LocalAudioFileErrorCode
  | 'MISSING_AUDIO_BYTES'
  | 'DECODE_FAILED'
  | 'INVALID_DURATION'
  | 'AUDIO_TOO_LONG'
  | 'NO_AUDIO_CHANNELS';

export class AudioImportError extends Error {
  code: AudioImportErrorCode;

  constructor(code: AudioImportErrorCode) {
    super(code);
    this.name = 'AudioImportError';
    this.code = code;
  }
}

const channelLabel = (count: number): string => {
  if (count === 1) return 'MONO';
  if (count === 2) return 'STEREO';
  return `MULTI ${count}CH`;
};

export const decodeImportedAudio = async (
  input: LocalAudioFileResult,
): Promise<ImportedAudioRuntime> => {
  const validationError = validateAudioFileInput(input);
  if (validationError) throw new AudioImportError(validationError);
  if (!input.bytes || !input.fileName) throw new AudioImportError('MISSING_AUDIO_BYTES');

  const extension = input.extension ?? extensionFromFileName(input.fileName);
  if (!extension) throw new AudioImportError('UNSUPPORTED_EXTENSION');

  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(input.bytes.slice(0));
  } catch {
    throw new AudioImportError('DECODE_FAILED');
  }

  if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
    throw new AudioImportError('INVALID_DURATION');
  }
  if (decoded.duration > MAX_AUDIO_DURATION_SECONDS) {
    throw new AudioImportError('AUDIO_TOO_LONG');
  }
  if (decoded.numberOfChannels <= 0) {
    throw new AudioImportError('NO_AUDIO_CHANNELS');
  }

  const analysisMonoData = createAnalysisMonoData(decoded);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return {
    metadata: {
      id,
      fileName: input.fileName,
      extension: extension as SupportedAudioExtension,
      mimeType: input.mimeType ?? '',
      fileSizeBytes: input.fileSizeBytes ?? input.bytes.byteLength,
      durationSeconds: decoded.duration,
      sampleRate: decoded.sampleRate,
      numberOfChannels: decoded.numberOfChannels,
      channelLabel: channelLabel(decoded.numberOfChannels),
      importedAt: Date.now(),
    },
    originalBuffer: decoded,
    analysisMonoData,
  };
};
