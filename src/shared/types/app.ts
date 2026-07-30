export interface DrumulizerAppInfo {
  name: string;
  version: string;
  platform: string;
}

export type AppStatus = 'ready' | 'busy' | 'warning' | 'error';

export type SupportedAudioExtension = 'wav' | 'mp3';

export interface LocalAudioFileResult {
  canceled: boolean;
  fileName?: string;
  extension?: SupportedAudioExtension;
  mimeType?: string;
  fileSizeBytes?: number;
  bytes?: ArrayBuffer;
  errorMessage?: string;
}

export interface DrumulizerApi {
  getAppInfo: () => DrumulizerAppInfo;
  selectLocalAudioFile: () => Promise<LocalAudioFileResult>;
}
