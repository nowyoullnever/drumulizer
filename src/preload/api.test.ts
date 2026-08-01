import { describe, expect, it } from 'vitest';
import { createDrumulizerApi } from './api';

describe('preload api', () => {
  it('exposes metadata and a narrow local audio picker contract', () => {
    const api = createDrumulizerApi('win32');
    expect(Object.keys(api)).toEqual([
      'getAppInfo',
      'selectLocalAudioFile',
      'registerAudioBytes',
      'openProject',
      'saveProject',
      'saveLinkedProjectAs',
      'savePortableProjectAs',
      'relinkMissingSource',
      'chooseExportDirectoryAndWrite',
    ]);
    expect(api.getAppInfo()).toEqual({
      name: 'Drumulizer',
      version: '0.9.0',
      platform: 'win32',
    });
    expect(typeof api.selectLocalAudioFile).toBe('function');
    expect(typeof api.registerAudioBytes).toBe('function');
    expect(typeof api.openProject).toBe('function');
    expect(typeof api.saveProject).toBe('function');
    expect(typeof api.saveLinkedProjectAs).toBe('function');
    expect(typeof api.savePortableProjectAs).toBe('function');
    expect(typeof api.relinkMissingSource).toBe('function');
    expect(typeof api.chooseExportDirectoryAndWrite).toBe('function');
  });
});
