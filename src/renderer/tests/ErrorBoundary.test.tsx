import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';

function BrokenComponent(): ReactNode {
  throw new Error('private local path should not be shown');
}

describe('ErrorBoundary', () => {
  it('shows a concise branded fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('DRUMULIZER RENDERER ERROR')).toBeInTheDocument();
    expect(screen.queryByText(/private local path/i)).not.toBeInTheDocument();
  });
});
