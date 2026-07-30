import { locales } from '../i18n/translations';
import type { Locale, TranslationKey } from '../i18n/translations';
import { useI18n } from '../i18n/useI18n';

const localeLabelKeys: Record<Locale, TranslationKey> = {
  ko: 'language.ko',
  en: 'language.en',
};

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <fieldset className="language-switch" aria-label={t('language.label')}>
      {locales.map((option) => (
        <label key={option} className="language-switch__option">
          <input
            type="radio"
            name="drumulizer-language"
            value={option}
            checked={locale === option}
            onChange={() => setLocale(option)}
          />
          <span>{t(localeLabelKeys[option])}</span>
        </label>
      ))}
    </fieldset>
  );
}
