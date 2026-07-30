import { MAX_AUDIO_DURATION_SECONDS } from '../../shared/constants/audio';
import type { LocalAudioFileResult, SupportedAudioExtension } from '../../shared/types/app';
import { createAnalysisMonoData } from './mixdown';
import type { ImportedAudioRuntime } from './types';
import { extensionFromFileName, validateAudioFileInput } from './validation';

let audioContext: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  audioContext ??= new AudioContext();
  return audioContext;
};

const channelLabel = (count: number): string => {
  if (count === 1) return 'MONO';
  if (count === 2) return 'STEREO';
  return `MULTI ${count}CH`;
};

export const decodeImportedAudio = async (
  input: LocalAudioFileResult,
): Promise<ImportedAudioRuntime> => {
  const validationMessage = validateAudioFileInput(input);
  if (validationMessage) throw new Error(validationMessage);
  if (!input.bytes || !input.fileName) throw new Error('오디오 파일을 읽지 못했습니다.');

  const extension = input.extension ?? extensionFromFileName(input.fileName);
  if (!extension) throw new Error('지원하지 않는 파일 형식입니다. WAV 또는 MP3 파일을 선택하세요.');

  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }

  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(input.bytes.slice(0));
  } catch {
    throw new Error('오디오 파일을 해석하지 못했습니다. 파일이 손상되었을 수 있습니다.');
  }

  if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
    throw new Error('오디오 길이가 올바르지 않습니다.');
  }
  if (decoded.duration > MAX_AUDIO_DURATION_SECONDS) {
    throw new Error('오디오 길이는 30분을 넘을 수 없습니다.');
  }
  if (decoded.numberOfChannels <= 0) {
    throw new Error('오디오 채널이 없습니다.');
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
