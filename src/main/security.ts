import { app, BrowserWindow, session, type WebContents } from 'electron';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const isLoopbackDevRequest = (url: string, isDevelopment: boolean): boolean => {
  if (!isDevelopment) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'ws:'].includes(parsed.protocol) && LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

const isAppLocalRequest = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['file:', 'data:', 'devtools:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const configureSessionSecurity = (isDevelopment: boolean): void => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const { url } = details;
    const allowed = isAppLocalRequest(url) || isLoopbackDevRequest(url, isDevelopment);

    if (!allowed && /^https?:/i.test(url)) {
      callback({ cancel: true });
      return;
    }

    callback({ cancel: false });
  });
};

export const configureWindowSecurity = (window: BrowserWindow): void => {
  window.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
    }
  });
};

export const registerSecurityGuards = (isDevelopment: boolean): void => {
  app.on('web-contents-created', (_event, contents: WebContents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });

  configureSessionSecurity(isDevelopment);
};
