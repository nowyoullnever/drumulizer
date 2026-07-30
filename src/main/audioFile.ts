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
      title: '오디오 파일 열기',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const [filePath] = result.filePaths;
    const extension = normalizeExtension(filePath);
    if (!extension) {
      return {
        canceled: false,
        errorMessage: '지원하지 않는 파일 형식입니다. WAV 또는 MP3 파일을 선택하세요.',
      };
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return {
        canceled: false,
        errorMessage: '폴더는 불러올 수 없습니다. 오디오 파일을 선택하세요.',
      };
    }

    if (fileStat.size === 0) {
      return { canceled: false, errorMessage: '빈 파일은 불러올 수 없습니다.' };
    }

    if (fileStat.size > MAX_AUDIO_FILE_BYTES) {
      return {
        canceled: false,
        errorMessage: '파일 크기는 250MB를 넘을 수 없습니다.',
      };
    }

    const bytes = await readFile(filePath);
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
