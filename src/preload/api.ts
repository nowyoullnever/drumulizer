import { ipcRenderer } from 'electron';
import { AUDIO_IMPORT_CHANNEL, AUDIO_REGISTER_BYTES_CHANNEL } from '../shared/constants/audio';
import { createSerializableAppInfo } from '../shared/constants/appInfo';
import {
  EXPORT_WRITE_FILES_CHANNEL,
  PROJECT_OPEN_CHANNEL,
  PROJECT_RELINK_SOURCE_CHANNEL,
  PROJECT_SAVE_CHANNEL,
  PROJECT_SAVE_LINKED_AS_CHANNEL,
  PROJECT_SAVE_PORTABLE_AS_CHANNEL,
} from '../shared/constants/project';
import type { DrumulizerApi } from '../shared/types/app';

export const createDrumulizerApi = (platform: string): DrumulizerApi => ({
  getAppInfo: () => createSerializableAppInfo(platform),
  selectLocalAudioFile: () => ipcRenderer.invoke(AUDIO_IMPORT_CHANNEL),
  registerAudioBytes: (request) => ipcRenderer.invoke(AUDIO_REGISTER_BYTES_CHANNEL, request),
  openProject: () => ipcRenderer.invoke(PROJECT_OPEN_CHANNEL),
  saveProject: (request) => ipcRenderer.invoke(PROJECT_SAVE_CHANNEL, request),
  saveLinkedProjectAs: (request) => ipcRenderer.invoke(PROJECT_SAVE_LINKED_AS_CHANNEL, request),
  savePortableProjectAs: (request) => ipcRenderer.invoke(PROJECT_SAVE_PORTABLE_AS_CHANNEL, request),
  relinkMissingSource: (sourceDescriptor) =>
    ipcRenderer.invoke(PROJECT_RELINK_SOURCE_CHANNEL, sourceDescriptor),
  chooseExportDirectoryAndWrite: (request) =>
    ipcRenderer.invoke(EXPORT_WRITE_FILES_CHANNEL, request),
});
