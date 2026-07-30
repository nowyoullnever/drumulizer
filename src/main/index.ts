import { app, BrowserWindow } from 'electron';
import { isDevelopment } from './environment';
import { registerSecurityGuards } from './security';
import { createMainWindow } from './window';
import { APP_ID, APP_NAME } from '../shared/version';

app.setAppUserModelId(APP_ID);
app.name = APP_NAME;

const boot = async (): Promise<void> => {
  registerSecurityGuards(isDevelopment);
  await createMainWindow(isDevelopment);
};

app.whenReady().then(boot);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow(isDevelopment);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
