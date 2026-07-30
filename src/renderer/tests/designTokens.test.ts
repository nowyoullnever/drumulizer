import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('design tokens stylesheet', () => {
  it('defines centralized semantic theme variables', () => {
    const tokens = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8');
    expect(tokens).toContain('--surface-primary');
    expect(tokens).toContain('--focus-ring');
    expect(tokens).toContain('--color-cobalt');
  });
});
