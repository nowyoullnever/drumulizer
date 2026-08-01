import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { WINDOW_TITLE } from '../shared/version';
import { registerAudioFileHandlers } from './audioFile';
import { registerProjectHandlers } from './projectHandlers';
import { configureWindowSecurity } from './security';
import type { SourceRegistry } from './sourceRegistry';

export const createMainWindow = async (
  isDevelopment: boolean,
  sourceRegistry: SourceRegistry,
): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 1120,
    minHeight: 700,
    title: WINDOW_TITLE,
    show: false,
    backgroundColor: '#e5d5aa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  configureWindowSecurity(window);
  registerAudioFileHandlers(window, sourceRegistry);
  registerProjectHandlers(window, sourceRegistry);

  window.once('ready-to-show', () => {
    window.show();
  });

  if (isDevelopment && process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
};
