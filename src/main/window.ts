import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { WINDOW_TITLE } from '../shared/version';
import { registerAudioFileHandlers } from './audioFile';
import { configureWindowSecurity } from './security';

export const createMainWindow = async (isDevelopment: boolean): Promise<BrowserWindow> => {
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
  registerAudioFileHandlers(window);

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
