import { APP_NAME, APP_VERSION } from '../version';
import type { DrumulizerAppInfo } from '../types/app';

export const createSerializableAppInfo = (platform: string): DrumulizerAppInfo => ({
  name: APP_NAME,
  version: APP_VERSION,
  platform,
});
