import { describe, expect, it } from 'vitest';
import {
  defaultLocale,
  formatTranslation,
  translate,
  translations,
  type Locale,
} from '../i18n/translations';
import {
  detectLocale,
  localeStorageKey,
  loadStoredLocale,
  saveLocale,
} from '../i18n/localeStorage';

describe('i18n dictionaries', () => {
  it('keeps Korean and English dictionaries in key parity', () => {
    const koreanKeys = Object.keys(translations.ko).sort();
    const englishKeys = Object.keys(translations.en).sort();
    expect(englishKeys).toEqual(koreanKeys);
  });

  it('formats placeholders and falls back through the central translator', () => {
    expect(formatTranslation('v{version}', { version: '0.2.0' })).toBe('v0.2.0');
    expect(translate('en', 'app.about')).toBe('About');
  });

  it('detects and persists supported locales', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('ko-KR')).toBe('ko');
    expect(detectLocale('fr-FR')).toBe(defaultLocale);

    const storage = window.localStorage;
    storage.removeItem(localeStorageKey);
    expect(loadStoredLocale(storage)).toBeNull();
    saveLocale('en' satisfies Locale, storage);
    expect(loadStoredLocale(storage)).toBe('en');
  });
});
