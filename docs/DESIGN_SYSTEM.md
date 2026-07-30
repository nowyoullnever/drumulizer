# Design System

Drumulizer combines 1970s avant-garde fashion graphics, saturated but faded print color, geometric textile references, modular hardware structure, and pixel-interface construction.

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

Reusable presets: checker, diagonal stripe, halftone dot, stepped block, and wide horizontal band. Patterns are reserved for identity strips, placeholders, section labels, modal headers, and swatches. Dense patterns must not sit behind small text, future waveforms, sequencer steps, numeric controls, or error messages.

## Component States

Components support hover, active, selected, pressed, disabled, and focus-visible states. Icon-only controls need `aria-label`.

## Future Lane Mapping

- LOW: tomato/orange with horizontal band pattern
- MID: mustard with diagonal pattern
- HIGH: cobalt with checker-inspired structure
- TEXTURE: teal/violet with dot or block pattern

## Forbidden Styles

Avoid generic SaaS cards, glassmorphism, glossy knobs, black-and-neon DAW styling, pastel productivity styling, large rounded controls, externally hosted assets, and decorative animation that harms usability.
