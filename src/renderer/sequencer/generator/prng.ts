import {
  DEFAULT_GENERATOR_SEED,
  MAX_GENERATOR_SEED_LENGTH,
} from '../../../shared/constants/sequencer';

export const normalizeSeed = (seed: string): string => {
  const compact = seed
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-+/g, '-');
  const normalized = compact.replace(/^-|-$/g, '').slice(0, MAX_GENERATOR_SEED_LENGTH);
  return normalized.length > 0 ? normalized : DEFAULT_GENERATOR_SEED;
};

export const fnv1a = (seed: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export interface DeterministicPrng {
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (amount: number) => boolean;
  pickIndex: (length: number) => number;
}

export const createPrng = (seed: string): DeterministicPrng => {
  let state = fnv1a(normalizeSeed(seed));
  const next = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (amount) => next() < Math.max(0, Math.min(1, amount)),
    pickIndex: (length) => (length <= 0 ? -1 : Math.floor(next() * length)),
  };
};

export const deterministicId = (parts: string[]): string =>
  `evtg-${fnv1a(parts.map(normalizeSeed).join('_')).toString(36)}`;
