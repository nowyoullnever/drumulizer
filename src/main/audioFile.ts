import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { AUDIO_IMPORT_CHANNEL, AUDIO_REGISTER_BYTES_CHANNEL } from '../shared/constants/audio';
import type { LocalAudioFileErrorCode, LocalAudioFileResult } from '../shared/types/app';
import type { SourceRegistry } from './sourceRegistry';

const errorCodeFromUnknown = (error: unknown): LocalAudioFileErrorCode =>
  error instanceof Error &&
  ['UNSUPPORTED_EXTENSION', 'NOT_A_REGULAR_FILE', 'EMPTY_FILE', 'FILE_TOO_LARGE'].includes(
    error.message,
  )
    ? (error.message as LocalAudioFileErrorCode)
    : 'READ_FAILED';

export const registerAudioFileHandlers = (
  window: BrowserWindow,
  registry: SourceRegistry,
): void => {
  ipcMain.handle(AUDIO_IMPORT_CHANNEL, async (): Promise<LocalAudioFileResult> => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Open Audio File',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const [filePath] = result.filePaths;
    try {
      const source = await registry.registerLinked(filePath);
      return registry.toImportResult(source);
    } catch (error) {
      return { canceled: false, errorCode: errorCodeFromUnknown(error) };
    }
  });

  ipcMain.handle(
    AUDIO_REGISTER_BYTES_CHANNEL,
    async (
      _event,
      request: { fileName?: unknown; bytes?: unknown },
    ): Promise<LocalAudioFileResult> => {
      if (typeof request.fileName !== 'string' || !(request.bytes instanceof ArrayBuffer)) {
        return { canceled: false, errorCode: 'READ_FAILED' };
      }
      try {
        const source = await registry.registerTemporaryBytes(
          request.fileName,
          new Uint8Array(request.bytes),
          'temporary',
        );
        return registry.toImportResult(source);
      } catch (error) {
        return { canceled: false, errorCode: errorCodeFromUnknown(error) };
      }
    },
  );
};
