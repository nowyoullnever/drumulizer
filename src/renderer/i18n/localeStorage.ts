import { defaultLocale, isLocale, type Locale } from './translations';

export const localeStorageKey = 'drumulizer.preference.locale';

export const detectLocale = (language = navigator.language): Locale => {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ko')) return 'ko';
  return defaultLocale;
};

export const loadStoredLocale = (storage: Storage = window.localStorage): Locale | null => {
  try {
    const stored = storage.getItem(localeStorageKey);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const saveLocale = (locale: Locale, storage: Storage = window.localStorage): void => {
  try {
    storage.setItem(localeStorageKey, locale);
  } catch {
    // Locale persistence is a convenience; the UI still works without storage.
  }
};

export const resolveInitialLocale = (): Locale => loadStoredLocale() ?? detectLocale();
