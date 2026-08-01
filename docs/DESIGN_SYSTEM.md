# Design System

Drumulizer combines 1970s avant-garde fashion graphics, saturated but faded print color, geometric textile references, modular hardware structure, and pixel-interface construction. v0.4.0 adds onset-analysis candidate preview while preserving this identity.

## v0.5.0 Slice Library

The Slice Library keeps the same bordered modular pixel language while becoming a dense working surface. Role color is functional: low uses tomato, mid uses mustard, high uses cobalt, texture uses teal, and unclassified remains neutral. Cards are not nested; list rows, inspector blocks, and role summary chips are compact repeated items.

## v0.7.0 Pattern Generator

The Pattern Generator is a compact control surface, not a landing section. Seed, Density, Variation, Breakage, Generation Mode, Generation Scope, Generate, Regenerate, and Mutate live near the Sequencer grid. Generated, mutated, manual, Event-locked, and Lane-locked states must be visible without replacing the lane role colors.

## v0.8.0 IDM Transform

IDM Transform controls remain a dense sequencer work surface. Transformation indicators must supplement existing lane colors rather than replacing them. Probability, Timing, Ratchet, Reverse, Granular, and lock states must not rely on color alone.

## Palette

Raw colors live in `src/renderer/styles/tokens.css`: paper, paper-light, ink, ink-soft, tomato, orange, mustard, cobalt, teal, violet, success, warning, and danger.

Semantic tokens include `--surface-primary`, `--surface-secondary`, `--surface-raised`, `--text-primary`, `--text-muted`, `--border-primary`, `--control-active`, `--control-hover`, `--control-disabled`, and `--focus-ring`.

Pure white and pure black are avoided as dominant colors.

## Typography

The primary typeface is the bundled `x10y12pxDenkiChipHangul.woff2`, exposed internally as `DenkiChipHangul`. Monospace fallbacks are used for resilience. Korean interface text is included in the shell to verify Hangul coverage.

## Pixel Grid

- Base unit: 2px
- Main rhythm: 4px, 8px, 12px, 16px, 24px, 32px
- Standard border: 2px
- Emphasis border: 4px
- Radius: 0px or 2px

Controls use integer dimensions and clear pressed states.

## Patterns

Reusable presets: checker, diagonal stripe, halftone dot, stepped block, and wide horizontal band. Patterns are reserved for identity strips, placeholders, section labels, modal headers, and swatches. Dense patterns must not sit behind small text, waveforms, sequencer steps, numeric controls, or error messages. The waveform canvas uses a quieter paper-toned surface without textile patterning behind audio data.

## Component States

Components support hover, active, selected, pressed, disabled, and focus-visible states. Icon-only controls need `aria-label`.

## Slice Editor

The slice editor uses the same modular hardware language as the rest of the workspace. Markers are high-contrast vertical handles over the waveform, fixed source boundaries are visually distinct from editable markers, and the selected slice uses a translucent block highlight that does not obscure waveform peaks.

The Slice Set panel keeps edit controls compact: tool selection, Undo/Redo, Reset Markers, zero-crossing assist, equal division presets, and custom division live together. The Selected Slice panel focuses on the current region's timing, sample range, navigation, audition, pre-roll, and marker deletion.

Slice Map blocks are proportional to sample duration and must remain scannable when there are many slices. Compact labels are allowed when dense maps would otherwise overflow.

## Candidate Preview

Onset preview candidates are drawn as non-destructive waveform overlays. They use vertical marker lines plus band-specific symbols so the selected candidate is not indicated by color alone. Dense candidate sets must remain usable without rendering a text label for every candidate. The selected preview candidate uses stronger contrast and line weight, while committed slice markers remain visually distinct.

The analysis panel shows candidate count, candidate density, strongest band, selected candidate number, time, confidence, dominant band, and supporting feature count. These diagnostics are compact control-surface information, not marketing copy or instrument classification.

## Header Status

The primary shell exposes one noninteractive app status module in the header next to the language switch and About action. It supports only `ready`, `processing`, and `error`, announces changes politely, and must not be duplicated by footer strips, offline badges, or placeholder system metrics.

The language switch is a compact radio group. It should preserve the current workspace state when toggled and must not imply network mode changes.

## Lane Mapping

- LOW: tomato/orange with horizontal band pattern
- MID: mustard with diagonal pattern
- HIGH: cobalt with checker-inspired structure
- TEXTURE: teal/violet with dot or block pattern

## Forbidden Styles

Avoid generic SaaS cards, glassmorphism, glossy knobs, black-and-neon DAW styling, pastel productivity styling, large rounded controls, externally hosted assets, and decorative animation that harms usability.
