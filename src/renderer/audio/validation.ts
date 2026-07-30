import { MAX_AUDIO_FILE_BYTES } from '../../shared/constants/audio';
import type { LocalAudioFileResult, SupportedAudioExtension } from '../../shared/types/app';

const SUPPORTED = new Set(['wav', 'mp3']);

export type ValidationInput = Pick<
  LocalAudioFileResult,
  'fileName' | 'extension' | 'fileSizeBytes' | 'bytes' | 'canceled'
>;

export const extensionFromFileName = (fileName: string): SupportedAudioExtension | null => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension && SUPPORTED.has(extension) ? (extension as SupportedAudioExtension) : null;
};

export const validateAudioFileInput = (input: ValidationInput): string | null => {
  if (input.canceled) return null;
  const fileName = input.fileName ?? '';
  const extension = input.extension ?? extensionFromFileName(fileName);
  const size = input.fileSizeBytes ?? input.bytes?.byteLength ?? 0;

  if (!extension) {
    return '지원하지 않는 파일 형식입니다. WAV 또는 MP3 파일을 선택하세요.';
  }
  if (!input.bytes || size === 0) {
    return '빈 파일은 불러올 수 없습니다.';
  }
  if (size > MAX_AUDIO_FILE_BYTES) {
    return '파일 크기는 250MB를 넘을 수 없습니다.';
  }
  return null;
};
