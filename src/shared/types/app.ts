export interface DrumulizerAppInfo {
  name: string;
  version: string;
  platform: string;
}

export type AppStatus = 'ready' | 'processing' | 'error';

export type SupportedAudioExtension = 'wav' | 'mp3';

export type LocalAudioFileErrorCode =
  'UNSUPPORTED_EXTENSION' | 'NOT_A_REGULAR_FILE' | 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'READ_FAILED';

export interface LocalAudioFileResult {
  canceled: boolean;
  fileName?: string;
  extension?: SupportedAudioExtension;
  mimeType?: string;
  fileSizeBytes?: number;
  bytes?: ArrayBuffer;
  errorCode?: LocalAudioFileErrorCode;
}

export interface DrumulizerApi {
  getAppInfo: () => DrumulizerAppInfo;
  selectLocalAudioFile: () => Promise<LocalAudioFileResult>;
}
