export interface DrumulizerAppInfo {
  name: string;
  version: string;
  platform: string;
}

export type AppStatus = 'ready' | 'busy' | 'warning' | 'error';

export interface DrumulizerApi {
  getAppInfo: () => DrumulizerAppInfo;
}
