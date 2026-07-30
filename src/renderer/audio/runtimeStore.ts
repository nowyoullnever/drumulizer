import type { ImportedAudioRuntime } from './types';

let currentSource: ImportedAudioRuntime | null = null;

export const audioRuntimeStore = {
  set(source: ImportedAudioRuntime): void {
    currentSource = source;
  },
  get(): ImportedAudioRuntime | null {
    return currentSource;
  },
  clear(): void {
    currentSource = null;
  },
};
