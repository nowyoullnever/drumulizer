/// <reference types="vite/client" />

import type { DrumulizerApi } from './shared/types/app';

declare global {
  interface Window {
    drumulizer?: DrumulizerApi;
  }
}
