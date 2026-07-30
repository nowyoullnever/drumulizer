import { MAX_PATTERN_HISTORY_ENTRIES } from '../../shared/constants/sequencer';
import type { SequencerPattern } from './types';

export interface PatternHistoryState {
  pattern: SequencerPattern;
  selectedEventId: string | null;
}

export interface PatternHistory {
  past: PatternHistoryState[];
  present: PatternHistoryState;
  future: PatternHistoryState[];
}

export const createPatternHistory = (initial: PatternHistoryState): PatternHistory => ({
  past: [],
  present: initial,
  future: [],
});

export const pushPatternHistory = (
  history: PatternHistory,
  next: PatternHistoryState,
): PatternHistory => ({
  past: [...history.past, history.present].slice(-MAX_PATTERN_HISTORY_ENTRIES),
  present: next,
  future: [],
});

export const undoPatternHistory = (history: PatternHistory): PatternHistory => {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, MAX_PATTERN_HISTORY_ENTRIES),
  };
};

export const redoPatternHistory = (history: PatternHistory): PatternHistory => {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-MAX_PATTERN_HISTORY_ENTRIES),
    present: next,
    future: history.future.slice(1),
  };
};
