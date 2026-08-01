import { app, BrowserWindow } from 'electron';
import { isDevelopment } from './environment';
import { registerSecurityGuards } from './security';
import { SourceRegistry } from './sourceRegistry';
import { createMainWindow } from './window';
import { APP_ID, APP_NAME } from '../shared/version';

app.setAppUserModelId(APP_ID);
app.name = APP_NAME;

const sourceRegistry = new SourceRegistry();

const boot = async (): Promise<void> => {
  registerSecurityGuards(isDevelopment);
  await createMainWindow(isDevelopment, sourceRegistry);
};

app.whenReady().then(boot);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow(isDevelopment, sourceRegistry);
  }
});

app.on('before-quit', () => {
  void sourceRegistry.cleanup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
