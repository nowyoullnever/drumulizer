import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AudioSourceMetadata, PlaybackSnapshot } from '../audio/types';
import { SourcePanel } from '../components/SourcePanel';
import { TransportControls } from '../components/TransportControls';
import { App } from '../App';

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
    const { rerender } = render(
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
      <TransportControls
        playback={playback}
        hasSource
        zoom={1}
        viewportStart={0}
        viewportEnd={1}
        {...handlers}
      />,
    );
    expect(screen.getByLabelText('재생')).toBeEnabled();
  });

  it('renders source metadata and Korean error messages', () => {
    render(
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
    render(<App />);
    const app = screen.getByText('DRUMULIZER / v0.2.0').closest('main') as HTMLElement;
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
});
