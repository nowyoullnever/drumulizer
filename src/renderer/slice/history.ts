import { MAX_HISTORY_ENTRIES } from '../../shared/constants/slice';
import type { SliceHistoryState } from './types';

export interface SliceHistory {
  past: SliceHistoryState[];
  present: SliceHistoryState;
  future: SliceHistoryState[];
}

export const createSliceHistory = (initial: SliceHistoryState): SliceHistory => ({
  past: [],
  present: initial,
  future: [],
});

export const pushSliceHistory = (history: SliceHistory, next: SliceHistoryState): SliceHistory => ({
  past: [...history.past, history.present].slice(-MAX_HISTORY_ENTRIES),
  present: next,
  future: [],
});

export const undoSliceHistory = (history: SliceHistory): SliceHistory => {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, MAX_HISTORY_ENTRIES),
  };
};

export const redoSliceHistory = (history: SliceHistory): SliceHistory => {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY_ENTRIES),
    present: next,
    future: history.future.slice(1),
  };
};
