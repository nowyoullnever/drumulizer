import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { AudioSourceMetadata, PlaybackSnapshot } from '../audio/types';
import { AppStatusModule } from '../components/AppStatusModule';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { SourcePanel } from '../components/SourcePanel';
import { TransportControls } from '../components/TransportControls';
import { I18nProvider } from '../i18n/I18nProvider';
import { localeStorageKey } from '../i18n/localeStorage';
import type { Locale } from '../i18n/translations';

const playback: PlaybackSnapshot = {
  status: 'ready',
  positionSeconds: 0,
  durationSeconds: 1,
  loopEnabled: false,
  masterGain: 0.5,
};

const metadata: AudioSourceMetadata = {
  id: 'source',
  fileName: 'local-test.wav',
  extension: 'wav',
  mimeType: 'audio/wav',
  fileSizeBytes: 44,
  durationSeconds: 1,
  sampleRate: 44100,
  numberOfChannels: 2,
  channelLabel: 'STEREO',
  importedAt: 1,
};

const renderWithI18n = (children: ReactNode, locale: Locale = 'ko') => {
  window.localStorage.setItem(localeStorageKey, locale);
  return render(<I18nProvider>{children}</I18nProvider>);
};

describe('audio UI behavior', () => {
  it('disables transport controls while empty and enables play when loaded', () => {
    const handlers = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onStop: vi.fn(),
      onLoopChange: vi.fn(),
      onGainChange: vi.fn(),
      onFit: vi.fn(),
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomChange: vi.fn(),
    };
    const { rerender } = renderWithI18n(
      <TransportControls
        playback={{ ...playback, status: 'unavailable' }}
        hasSource={false}
        zoom={1}
        viewportStart={0}
        viewportEnd={0}
        {...handlers}
      />,
    );
    expect(screen.getByLabelText('재생')).toBeDisabled();

    rerender(
      <I18nProvider>
        <TransportControls
          playback={playback}
          hasSource
          zoom={1}
          viewportStart={0}
          viewportEnd={1}
          {...handlers}
        />
      </I18nProvider>,
    );
    expect(screen.getByLabelText('재생')).toBeEnabled();
  });

  it('renders source metadata and localized import state', () => {
    renderWithI18n(
      <SourcePanel
        metadata={metadata}
        importState={{ status: 'ready', sourceId: 'source' }}
        onOpen={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('local-test.wav')).toBeInTheDocument();
    expect(screen.getByText('준비 완료')).toBeInTheDocument();
  });

  it('renders drag rejection and ignores keyboard shortcuts inside inputs', () => {
    renderWithI18n(<App />);
    const app = screen.getByText('DRUMULIZER / v0.4.0').closest('main') as HTMLElement;
    fireEvent.drop(app, {
      dataTransfer: {
        files: [
          { name: 'a.wav', size: 1 },
          { name: 'b.wav', size: 1 },
        ],
      },
    });
    expect(screen.getByText('여러 파일은 한 번에 불러올 수 없습니다.')).toBeInTheDocument();
    const zoom = screen.getByLabelText(/Zoom/i);
    fireEvent.keyDown(zoom, { key: ' ', code: 'Space' });
    expect(zoom).toBeInTheDocument();
  });

  it('keeps one app status module and removes legacy status strip metrics', () => {
    renderWithI18n(<App />, 'en');

    expect(document.querySelectorAll('.app-status-module')).toHaveLength(1);
    expect(document.querySelector('.app-status-module')).toHaveTextContent('App statusReady');
    expect(screen.queryByText('LOCAL ONLY')).not.toBeInTheDocument();
    expect(screen.queryByText('OFFLINE')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU --')).not.toBeInTheDocument();
    expect(screen.queryByText('VOICES --')).not.toBeInTheDocument();
    expect(screen.queryByText('CACHE --')).not.toBeInTheDocument();
    expect(document.querySelector('.bottom-strip')).not.toBeInTheDocument();
  });

  it('switches language by keyboard and keeps loaded source metadata visible', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <>
        <LanguageSwitch />
        <SourcePanel
          metadata={metadata}
          importState={{ status: 'ready', sourceId: 'source' }}
          onOpen={vi.fn()}
          onClear={vi.fn()}
        />
      </>,
    );

    expect(screen.getByText('파일 바꾸기')).toBeInTheDocument();
    await user.tab();
    await user.keyboard('[ArrowRight]');
    await user.keyboard('[Space]');

    expect(screen.getByText('Replace file')).toBeInTheDocument();
    expect(screen.getByText('local-test.wav')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('renders slice editor controls in both locales', async () => {
    const user = userEvent.setup();
    renderWithI18n(<App />);
    expect(screen.getByText('슬라이스 세트')).toBeInTheDocument();
    expect(screen.getAllByText('선택 슬라이스').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /\+ 마커 추가/ })).toBeInTheDocument();

    await user.click(
      screen.getByLabelText('언어').querySelector('input[value="en"]') as HTMLElement,
    );
    expect(screen.getByText('Slice Set')).toBeInTheDocument();
    expect(screen.getAllByText('Selected Slice').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /\+ Add Marker/ })).toBeInTheDocument();
  });

  it('localizes the status module states', () => {
    const { rerender } = renderWithI18n(<AppStatusModule status="processing" />, 'en');
    expect(screen.getByText('Processing')).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <AppStatusModule status="error" />
      </I18nProvider>,
    );
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });
});
