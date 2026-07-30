import { ipcRenderer } from 'electron';
import { AUDIO_IMPORT_CHANNEL } from '../shared/constants/audio';
import { createSerializableAppInfo } from '../shared/constants/appInfo';
import type { DrumulizerApi } from '../shared/types/app';

export const createDrumulizerApi = (platform: string): DrumulizerApi => ({
  getAppInfo: () => createSerializableAppInfo(platform),
  selectLocalAudioFile: () => ipcRenderer.invoke(AUDIO_IMPORT_CHANNEL),
});
