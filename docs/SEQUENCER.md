# Manual Sequencer

Drumulizer v0.6.0 adds a manual pattern sequencer. It is intentionally not a rhythm generator: users place slice events by hand and the engine only schedules those events accurately.

## Pattern Rules

- Four lanes: LOW, MID, HIGH, and TEXTURE.
- Fixed 4/4 time.
- Sixteenth-note grid, 16 steps per bar.
- Pattern length: 1-4 bars.
- Tempo range: 40-240 BPM.
- One event may exist per lane and step.
- Events reference `SliceRegion.id` values and store velocity, pan, and pitch.

## Editing

The main workspace now has Slice Library and Sequencer tabs. Selecting or auditioning a slice can make it the active slice for the sequencer. The Sequencer tab supports select, paint, and erase tools; lane mute, solo, volume, and clear actions; whole-pattern clear; and pattern undo/redo.

Structural edits are locked while pattern transport is playing or paused. This prevents grid length, BPM, and event topology from changing while scheduled audio is already in flight. Non-structural transport and lane playback controls can still update the next scheduling window.

## Slice Reconciliation

Events keep stable slice ids. When a source is replaced, cleared, or slice boundaries change, the pattern is reconciled against the current slice set. Events with missing slice references are removed and the selected event is cleared if necessary.

## Scheduling

`SequencerEngine` uses a Web Audio look-ahead scheduler. Timer ticks prepare events in a short future window, but event starts are scheduled with `AudioContext` time. Scheduled keys combine loop index and event id so loop boundaries do not duplicate events. Event gain is derived from velocity, lane gain, and master gain; pan and pitch are applied at event scheduling time.

The scheduler deliberately excludes BPM detection, swing, humanize, probability, automatic generation, MIDI, save/load, and export in v0.6.0.
