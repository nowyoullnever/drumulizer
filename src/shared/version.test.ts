import { describe, expect, it } from 'vitest';
import { APP_ID, APP_NAME, APP_VERSION, WINDOW_TITLE } from './version';

describe('application identity', () => {
  it('uses the v0.2.0 Drumulizer identity consistently', () => {
    expect(APP_NAME).toBe('Drumulizer');
    expect(APP_VERSION).toBe('0.2.0');
    expect(APP_ID).toBe('com.nowyoullnever.drumulizer');
    expect(WINDOW_TITLE).toBe('Drumulizer v0.2.0');
  });
});
