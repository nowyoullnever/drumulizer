import { createSerializableAppInfo } from '../shared/constants/appInfo';
import type { DrumulizerApi } from '../shared/types/app';

export const createDrumulizerApi = (platform: string): DrumulizerApi => ({
  getAppInfo: () => createSerializableAppInfo(platform),
});
