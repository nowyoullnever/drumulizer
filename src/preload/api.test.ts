import { describe, expect, it } from 'vitest';
import { createDrumulizerApi } from './api';

describe('preload api', () => {
  it('exposes metadata and a narrow local audio picker contract', () => {
    const api = createDrumulizerApi('win32');
    expect(Object.keys(api)).toEqual(['getAppInfo', 'selectLocalAudioFile']);
    expect(api.getAppInfo()).toEqual({
      name: 'Drumulizer',
      version: '0.8.0',
      platform: 'win32',
    });
    expect(typeof api.selectLocalAudioFile).toBe('function');
  });
});
