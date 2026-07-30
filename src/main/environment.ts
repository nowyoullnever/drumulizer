export const isDevelopment = process.env.NODE_ENV === 'development' || !appIsPackaged();

function appIsPackaged(): boolean {
  return process.defaultApp === false && process.env.ELECTRON_IS_DEV !== '1';
}
