import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { I18nProvider } from '../i18n/I18nProvider';
import { localeStorageKey } from '../i18n/localeStorage';

describe('analysis UI', () => {
  const panel = (
    <AnalysisPanel
      hasSource
      settings={{ sensitivity: 55, minimumGapMs: 45 }}
      analyzing={false}
      progress={null}
      candidates={[
        {
          id: 'onset-1',
          sampleIndex: 100,
          timeSeconds: 0.1,
          confidence: 1,
          score: 2,
          dominantBand: 'broadband',
        },
      ]}
      applyMode="merge"
      resultReason={null}
      applySummary={null}
      onSettingsChange={vi.fn()}
      onAnalyze={vi.fn()}
      onApplyModeChange={vi.fn()}
      onApply={vi.fn()}
      onDiscard={vi.fn()}
    />
  );

  it('renders Korean and English transient controls with preview count preserved', () => {
    window.localStorage.setItem(localeStorageKey, 'ko');
    const { unmount } = render(<I18nProvider>{panel}</I18nProvider>);
    expect(screen.getByText('후보')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    unmount();

    window.localStorage.setItem(localeStorageKey, 'en');
    render(<I18nProvider>{panel}</I18nProvider>);
    expect(screen.getByText('Candidates')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply as Markers' })).toBeInTheDocument();
  });
});
