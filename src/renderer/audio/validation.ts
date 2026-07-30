import { MAX_AUDIO_FILE_BYTES } from '../../shared/constants/audio';
import type {
  LocalAudioFileErrorCode,
  LocalAudioFileResult,
  SupportedAudioExtension,
} from '../../shared/types/app';

const SUPPORTED = new Set(['wav', 'mp3']);

export type ValidationInput = Pick<
  LocalAudioFileResult,
  'fileName' | 'extension' | 'fileSizeBytes' | 'bytes' | 'canceled'
>;

export const extensionFromFileName = (fileName: string): SupportedAudioExtension | null => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension && SUPPORTED.has(extension) ? (extension as SupportedAudioExtension) : null;
};

export const validateAudioFileInput = (input: ValidationInput): LocalAudioFileErrorCode | null => {
  if (input.canceled) return null;
  const fileName = input.fileName ?? '';
  const extension = input.extension ?? extensionFromFileName(fileName);
  const size = input.fileSizeBytes ?? input.bytes?.byteLength ?? 0;

  if (!extension) return 'UNSUPPORTED_EXTENSION';
  if (!input.bytes || size === 0) return 'EMPTY_FILE';
  if (size > MAX_AUDIO_FILE_BYTES) return 'FILE_TOO_LARGE';
  return null;
};
