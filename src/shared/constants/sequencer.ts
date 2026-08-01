export const SEQUENCER_BEATS_PER_BAR = 4;
export const SEQUENCER_STEPS_PER_BEAT = 4;
export const SEQUENCER_STEPS_PER_BAR = 16;

export const MIN_PATTERN_BARS = 1;
export const MAX_PATTERN_BARS = 4;
export const DEFAULT_PATTERN_BARS = 2;

export const MIN_PATTERN_BPM = 40;
export const MAX_PATTERN_BPM = 240;
export const DEFAULT_PATTERN_BPM = 120;

export const MAX_PATTERN_EVENTS = 256;
export const MAX_PATTERN_HISTORY_ENTRIES = 100;
export const MAX_ACTIVE_SEQUENCER_VOICES = 64;

export const MIN_LANE_GAIN_DB = -24;
export const MAX_LANE_GAIN_DB = 6;

export const MIN_EVENT_VELOCITY = 0;
export const MAX_EVENT_VELOCITY = 1;
export const MIN_EVENT_PAN = -1;
export const MAX_EVENT_PAN = 1;
export const MIN_EVENT_PITCH_SEMITONES = -24;
export const MAX_EVENT_PITCH_SEMITONES = 24;

export const DEFAULT_EVENT_VELOCITY = 1;
export const DEFAULT_EVENT_PAN = 0;
export const DEFAULT_EVENT_PITCH_SEMITONES = 0;

export const DEFAULT_GENERATOR_SEED = 'drumulizer-070';
export const MAX_GENERATOR_SEED_LENGTH = 32;
export const DEFAULT_GENERATOR_DENSITY = 50;
export const DEFAULT_GENERATOR_VARIATION = 40;
export const DEFAULT_GENERATOR_BREAKAGE = 30;
export const MIN_GENERATOR_AMOUNT = 0;
export const MAX_GENERATOR_AMOUNT = 100;
export const MAX_GENERATOR_MUTATIONS_PER_ACTION = 24;

export const SEQUENCER_LOOKAHEAD_MS = 25;
export const SEQUENCER_SCHEDULE_AHEAD_SECONDS = 0.12;
export const SEQUENCER_EVENT_FADE_MS = 3;
