import { createContext } from 'react';
import type { Locale, TranslationKey, TranslationValues } from './translations';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
