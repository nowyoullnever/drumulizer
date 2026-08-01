# Localization

Drumulizer v0.4.0 includes internal Korean and English renderer localization.

## v0.5.0 Copy Areas

New Slice Analysis and Slice Library strings are present in both Korean and English. This includes lifecycle labels, role labels, filters, sorting labels, override/exclusion controls, recommendation text, and feature inspector labels.

## v0.7.0 Copy Areas

Pattern Generator strings are present in both Korean and English. This includes Seed controls, Density, Variation, Breakage, Generation Mode, Generation Scope, Generate, Regenerate, Mutate, Event locks, Lane generation locks, Event origin labels, disabled reasons, and generation summaries.

## v0.8.0 Copy Areas

IDM Transform strings are present in both Korean and English. This includes Swing, Probability, Microtiming, Ratchet, Reverse, Granular, Grain controls, Apply, Mutate, Reset, Event Transform controls, summaries, and no-change messages.

## Locale Flow

- Supported locales: `ko`, `en`
- Default locale: Korean
- Initial detection: `navigator.language`
- Persistence key: `drumulizer.preference.locale`
- Runtime switch: header radio group

Changing language updates `document.documentElement.lang` and preserves the current workspace state, including loaded source metadata, markers, slice history, selected slice, selected marker, onset preview candidates, selected preview candidate, waveform data, viewport, playback controls, and audition controls where practical.

## Translation Ownership

Renderer UI copy lives in `src/renderer/i18n/translations.ts`. Components call the central `t()` helper through `useI18n()` and should not branch on locale directly.

Main and preload code must not return localized user messages. Local file import failures use stable error codes from shared types; renderer import and decode failures use stable renderer error codes. The renderer maps those codes to locale-specific copy before showing banners or import-state text.

## Test Coverage

The test suite checks dictionary key parity, locale detection and persistence, keyboard-accessible language switching, source metadata preservation while switching language, slice-editor copy, onset-analysis copy, generator copy, IDM copy, localized app status states, and absence of the retired bottom status strip metrics.

## v0.4.0 Copy Areas

The onset-analysis interface owns localized strings for transient analysis title, sensitivity, minimum gap, progress, candidate count, candidate density, strongest band, candidate details, confidence, dominant band, support count, Previous/Next Candidate, Candidate Audition, Replace/Merge modes, Apply/Discard Preview, silent source, no candidates found, candidate cap, applied/skipped counts, analysis status, and worker failure surfaces.

## v0.9.0 Copy Areas

Project controls, dirty-state labels, project save/open feedback, and export commands have Korean and English dictionary entries. Language remains an app preference and is not serialized into project files.
