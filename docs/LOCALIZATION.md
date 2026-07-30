# Localization

Drumulizer v0.2.0 includes internal Korean and English renderer localization.

## Locale Flow

- Supported locales: `ko`, `en`
- Default locale: Korean
- Initial detection: `navigator.language`
- Persistence key: `drumulizer.preference.locale`
- Runtime switch: header radio group

Changing language updates `document.documentElement.lang` and preserves the current workspace state, including loaded source metadata, waveform data, and playback controls.

## Translation Ownership

Renderer UI copy lives in `src/renderer/i18n/translations.ts`. Components call the central `t()` helper through `useI18n()` and should not branch on locale directly.

Main and preload code must not return localized user messages. Local file import failures use stable error codes from shared types; renderer import and decode failures use stable renderer error codes. The renderer maps those codes to locale-specific copy before showing banners or import-state text.

## Test Coverage

The test suite checks dictionary key parity, locale detection and persistence, keyboard-accessible language switching, source metadata preservation while switching language, localized app status states, and absence of the retired bottom status strip metrics.
