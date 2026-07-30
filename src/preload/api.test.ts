import { describe, expect, it } from 'vitest';
import { createDrumulizerApi } from './api';

describe('preload api', () => {
  it('exposes only serializable application metadata', () => {
    const api = createDrumulizerApi('win32');
    expect(Object.keys(api)).toEqual(['getAppInfo']);
    expect(api.getAppInfo()).toEqual({
      name: 'Drumulizer',
      version: '0.1.0',
      platform: 'win32',
    });
  });
});
