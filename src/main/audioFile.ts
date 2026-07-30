import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { stat, readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { AUDIO_IMPORT_CHANNEL, MAX_AUDIO_FILE_BYTES } from '../shared/constants/audio';
import type { LocalAudioFileResult, SupportedAudioExtension } from '../shared/types/app';

const MIME_BY_EXTENSION: Record<SupportedAudioExtension, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

const normalizeExtension = (filePath: string): SupportedAudioExtension | null => {
  const extension = extname(filePath).replace('.', '').toLowerCase();
  return extension === 'wav' || extension === 'mp3' ? extension : null;
};

export const registerAudioFileHandlers = (window: BrowserWindow): void => {
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
    const extension = normalizeExtension(filePath);
    if (!extension) {
      return { canceled: false, errorCode: 'UNSUPPORTED_EXTENSION' };
    }

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(filePath);
    } catch {
      return { canceled: false, errorCode: 'READ_FAILED' };
    }

    if (!fileStat.isFile()) {
      return { canceled: false, errorCode: 'NOT_A_REGULAR_FILE' };
    }

    if (fileStat.size === 0) {
      return { canceled: false, errorCode: 'EMPTY_FILE' };
    }

    if (fileStat.size > MAX_AUDIO_FILE_BYTES) {
      return { canceled: false, errorCode: 'FILE_TOO_LARGE' };
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch {
      return { canceled: false, errorCode: 'READ_FAILED' };
    }

    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    return {
      canceled: false,
      fileName: basename(filePath),
      extension,
      mimeType: MIME_BY_EXTENSION[extension],
      fileSizeBytes: fileStat.size,
      bytes: arrayBuffer,
    };
  });
};
