import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_VERSION } from '../shared/version';
import type { AppStatus, DrumulizerAppInfo, LocalAudioFileResult } from '../shared/types/app';
import { audioRuntimeStore } from './audio/runtimeStore';
import { decodeImportedAudio } from './audio/importAudio';
import { PlaybackEngine } from './audio/playbackEngine';
import { buildWaveformPeaksInWorker } from './audio/peakWorkerClient';
import type {
  AudioImportState,
  AudioSourceMetadata,
  PlaybackSnapshot,
  WaveformPeaks,
} from './audio/types';
import { clamp } from './audio/time';
import { ErrorBanner } from './components/ErrorBanner';
import { PatternBackground } from './components/PatternBackground';
import { PixelButton } from './components/PixelButton';
import { PixelDialog } from './components/PixelDialog';
import { PixelPanel } from './components/PixelPanel';
import { PixelSectionHeader } from './components/PixelSectionHeader';
import { PixelTabs } from './components/PixelTabs';
import { SourcePanel } from './components/SourcePanel';
import { StatusBadge } from './components/StatusBadge';
import { TransportControls } from './components/TransportControls';
import { WaveformCanvas } from './components/WaveformCanvas';

const fallbackInfo: DrumulizerAppInfo = {
  name: 'Drumulizer',
  version: APP_VERSION,
  platform: 'renderer-preview',
};

const playbackEngine = new PlaybackEngine();

const makeDroppedAudioResult = async (file: File): Promise<LocalAudioFileResult> => ({
  canceled: false,
  fileName: file.name,
  extension: file.name.split('.').pop()?.toLowerCase() === 'mp3' ? 'mp3' : 'wav',
  mimeType: file.type,
  fileSizeBytes: file.size,
  bytes: await file.arrayBuffer(),
});

const selectFileInRendererPreview = (): Promise<LocalAudioFileResult> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav,.mp3,audio/wav,audio/mpeg';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve({ canceled: true });
        return;
      }
      resolve(makeDroppedAudioResult(file));
    });
    document.body.append(input);
    input.click();
  });

const initialPlayback = (): PlaybackSnapshot => playbackEngine.snapshot();

export function App() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('LOW');
  const [status, setStatus] = useState<AppStatus>('ready');
  const [importState, setImportState] = useState<AudioImportState>({ status: 'empty' });
  const [metadata, setMetadata] = useState<AudioSourceMetadata | null>(null);
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [playback, setPlayback] = useState<PlaybackSnapshot>(initialPlayback);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const importGeneration = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const appInfo = useMemo(() => window.drumulizer?.getAppInfo() ?? fallbackInfo, []);

  const duration = metadata?.durationSeconds ?? 0;
  const viewportDuration = duration > 0 ? duration / zoom : 1;
  const viewportEnd = Math.min(duration, viewportStart + viewportDuration);

  const resetViewport = useCallback((newDuration: number) => {
    setZoom(1);
    setViewportStart(0);
    if (newDuration <= 0) setPeaks(null);
  }, []);

  const importAudio = useCallback(
    async (resultPromise: Promise<LocalAudioFileResult>, label = '선택한 파일') => {
      const generation = importGeneration.current + 1;
      importGeneration.current = generation;
      setErrorMessage(null);
      setStatus('busy');
      setImportState({ status: 'reading', fileName: label });

      const result = await resultPromise;
      if (generation !== importGeneration.current) return;
      if (result.canceled) {
        setImportState(metadata ? { status: 'ready', sourceId: metadata.id } : { status: 'empty' });
        setStatus('ready');
        return;
      }
      if (result.errorMessage) {
        setErrorMessage(result.errorMessage);
        setImportState({ status: 'error', message: result.errorMessage });
        setStatus('error');
        return;
      }

      try {
        setImportState({ status: 'decoding', fileName: result.fileName ?? label });
        const decoded = await decodeImportedAudio(result);
        if (generation !== importGeneration.current) return;

        setImportState({ status: 'building-waveform', fileName: decoded.metadata.fileName });
        const builtPeaks = await buildWaveformPeaksInWorker(decoded.originalBuffer);
        if (generation !== importGeneration.current) return;

        playbackEngine.clear();
        audioRuntimeStore.set(decoded);
        setMetadata(decoded.metadata);
        setPeaks(builtPeaks);
        setPlayback(playbackEngine.load(decoded.originalBuffer));
        resetViewport(decoded.metadata.durationSeconds);
        setImportState({ status: 'ready', sourceId: decoded.metadata.id });
        setStatus('ready');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '오디오 파일을 불러오지 못했습니다. 다른 WAV 또는 MP3 파일을 선택하세요.';
        setErrorMessage(message);
        setImportState({ status: 'error', message });
        setStatus('error');
      }
    },
    [metadata, resetViewport],
  );

  const openFile = useCallback(() => {
    if (window.drumulizer) {
      void importAudio(window.drumulizer.selectLocalAudioFile(), '선택한 파일');
      return;
    }
    if (import.meta.env.DEV) {
      void importAudio(selectFileInRendererPreview(), '선택한 파일');
    }
  }, [importAudio]);

  const clearSource = useCallback(() => {
    importGeneration.current += 1;
    playbackEngine.clear();
    audioRuntimeStore.clear();
    setMetadata(null);
    setPeaks(null);
    setPlayback(playbackEngine.snapshot());
    setImportState({ status: 'empty' });
    setErrorMessage(null);
    setStatus('ready');
    resetViewport(0);
  }, [resetViewport]);

  const setViewportSafely = useCallback(
    (start: number, nextZoom = zoom) => {
      const nextDuration = duration > 0 ? duration / nextZoom : 1;
      setViewportStart(clamp(start, 0, Math.max(0, duration - nextDuration)));
    },
    [duration, zoom],
  );

  const setZoomSafely = useCallback(
    (nextZoom: number, anchorSeconds = viewportStart + viewportDuration / 2) => {
      const clampedZoom = clamp(nextZoom, 1, 16);
      const nextDuration = duration > 0 ? duration / clampedZoom : 1;
      const anchorRatio =
        viewportDuration > 0 ? (anchorSeconds - viewportStart) / viewportDuration : 0.5;
      const nextStart = anchorSeconds - nextDuration * clamp(anchorRatio, 0, 1);
      setZoom(clampedZoom);
      setViewportStart(clamp(nextStart, 0, Math.max(0, duration - nextDuration)));
    },
    [duration, viewportDuration, viewportStart],
  );

  const seek = useCallback((position: number) => {
    setPlayback(playbackEngine.seek(position));
  }, []);

  useEffect(() => {
    const tick = (): void => {
      setPlayback(playbackEngine.snapshot());
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
      playbackEngine.clear();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (!metadata) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (playback.status === 'playing') setPlayback(playbackEngine.pause());
        else void playbackEngine.play().then(setPlayback);
      }
      if (event.key === 'Home') setPlayback(playbackEngine.seek(0));
      if (event.key === 'ArrowLeft') {
        setPlayback(playbackEngine.seek(playback.positionSeconds - (event.shiftKey ? 5 : 0.5)));
      }
      if (event.key === 'ArrowRight') {
        setPlayback(playbackEngine.seek(playback.positionSeconds + (event.shiftKey ? 5 : 0.5)));
      }
      if (event.key.toLowerCase() === 'l') {
        setPlayback(playbackEngine.setLoop(!playback.loopEnabled));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [metadata, playback.loopEnabled, playback.positionSeconds, playback.status]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) {
        const message = '여러 파일은 한 번에 불러올 수 없습니다.';
        setErrorMessage(message);
        setImportState({ status: 'error', message });
        setStatus('error');
        return;
      }
      const [file] = files;
      if (!file || file.size === 0) {
        const message = '빈 파일은 불러올 수 없습니다.';
        setErrorMessage(message);
        setImportState({ status: 'error', message });
        setStatus('error');
        return;
      }
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'wav' && extension !== 'mp3') {
        const message = '지원하지 않는 파일 형식입니다. WAV 또는 MP3 파일을 선택하세요.';
        setErrorMessage(message);
        setImportState({ status: 'error', message });
        setStatus('error');
        return;
      }
      void importAudio(makeDroppedAudioResult(file), file.name);
    },
    [importAudio],
  );

  const isBusy = ['reading', 'decoding', 'building-waveform'].includes(importState.status);

  return (
    <main
      className="app"
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <header className="identity-strip">
        <PatternBackground preset="checker" className="identity-strip__mark" />
        <div>
          <h1>DRUMULIZER / v{appInfo.version}</h1>
          <p>프로젝트: UNTITLED / LOCAL AUDIO WORKSPACE</p>
        </div>
        <div className="identity-strip__status">
          <StatusBadge status="offline" label="LOCAL ONLY" />
          <StatusBadge status={status} label={status === 'busy' ? 'LOADING' : 'READY'} />
          <PixelButton onClick={() => setAboutOpen(true)}>ABOUT</PixelButton>
        </div>
      </header>

      <section className="project-status">
        <strong>AUDIO WORKSPACE</strong>
        <span>{metadata ? metadata.fileName : 'NO SAMPLE LOADED'}</span>
        <span>ANALYSIS MODULE NOT INSTALLED</span>
        <span>PATTERN ENGINE - v0.7.0</span>
      </section>

      {errorMessage ? <ErrorBanner title="오류" message={errorMessage} /> : null}

      <div className="workspace-grid workspace-grid--audio">
        <aside className="left-rail">
          <PixelPanel title="SOURCE" accent="tomato">
            <SourcePanel
              metadata={metadata}
              importState={importState}
              onOpen={openFile}
              onClear={clearSource}
              disabled={isBusy}
            />
          </PixelPanel>

          <PixelPanel title="ANALYSIS" accent="mustard">
            <div className="status-stack">
              <StatusBadge status="disabled" label="NOT INSTALLED" />
              <p>
                분석용 mono 데이터는 준비하지만 FFT, onset, HPSS, slicing은 v0.2.0에서 실행하지
                않습니다.
              </p>
            </div>
          </PixelPanel>
        </aside>

        <section className="main-workspace">
          <PixelSectionHeader
            label="WAVEFORM WORKSPACE"
            code={metadata ? metadata.channelLabel : 'EMPTY'}
          />
          <div className="waveform-shell">
            {isBusy ? (
              <div className="loading-strip" role="status">
                <span>
                  {importState.status === 'decoding'
                    ? '오디오 해석 중'
                    : importState.status === 'building-waveform'
                      ? '파형 만드는 중'
                      : '파일 읽는 중'}
                </span>
                <div className="loading-strip__bar" />
              </div>
            ) : null}
            <WaveformCanvas
              peaks={peaks}
              playback={playback}
              viewportStart={viewportStart}
              viewportDuration={viewportDuration}
              onSeek={seek}
              onPan={(delta) => setViewportSafely(viewportStart + delta)}
              onWheelZoom={(factor, anchor) => setZoomSafely(zoom * factor, anchor)}
            />
          </div>

          <PixelSectionHeader label="PATTERN WORKSPACE" code="v0.7.0 DISABLED" />
          <div className="pattern-workspace pattern-workspace--disabled">
            <PixelTabs
              tabs={['LOW', 'MID', 'HIGH', 'TEXTURE']}
              selected={selectedTab}
              onSelect={setSelectedTab}
            />
            <div className={`lane-preview lane-preview--${selectedTab.toLowerCase()}`}>
              <strong>PATTERN ENGINE - v0.7.0</strong>
              <span>Sequencer, slice marker, pattern generation은 아직 구현되지 않았습니다.</span>
            </div>
          </div>
        </section>

        <aside className="control-rail">
          <PixelPanel title="TRANSPORT" accent="teal">
            <TransportControls
              playback={playback}
              hasSource={Boolean(metadata)}
              zoom={zoom}
              viewportStart={viewportStart}
              viewportEnd={viewportEnd}
              onPlay={() => void playbackEngine.play().then(setPlayback)}
              onPause={() => setPlayback(playbackEngine.pause())}
              onStop={() => setPlayback(playbackEngine.stop())}
              onLoopChange={(enabled) => setPlayback(playbackEngine.setLoop(enabled))}
              onGainChange={(gain) => setPlayback(playbackEngine.setMasterGain(gain))}
              onFit={() => {
                setZoom(1);
                setViewportStart(0);
              }}
              onZoomIn={() => setZoomSafely(zoom * 1.5)}
              onZoomOut={() => setZoomSafely(zoom / 1.5)}
              onZoomChange={(nextZoom) => setZoomSafely(nextZoom)}
            />
          </PixelPanel>
        </aside>
      </div>

      {dragActive ? (
        <div className="drag-overlay" aria-hidden="true">
          <strong>로컬 WAV / MP3 놓기</strong>
          <span>URL, 폴더, 여러 파일은 받지 않습니다.</span>
        </div>
      ) : null}

      <footer className="bottom-strip">
        <StatusBadge status="offline" label="LOCAL ONLY" />
        <span>CPU --</span>
        <span>VOICES --</span>
        <span>CACHE --</span>
        <span>STATUS {status.toUpperCase()}</span>
        <strong>Drumulizer v{appInfo.version}</strong>
      </footer>

      <PixelDialog open={aboutOpen} title="ABOUT DRUMULIZER" onClose={() => setAboutOpen(false)}>
        <p>
          Drumulizer v{appInfo.version}는 로컬 WAV/MP3 import, 파형 표시, 기본 재생을 제공합니다.
        </p>
        <p>네트워크 import, 원격 API, telemetry, CDN, remote asset은 없습니다.</p>
        <p>단축키: Space 재생/일시정지, Home 처음으로, ←/→ 짧은 이동, Shift+←/→ 긴 이동, L loop.</p>
        <p>Typeface: x10y12pxDenkiChipHangul, bundled locally under the SIL Open Font License.</p>
        <p>Repository: nowyoullnever/drumulizer</p>
      </PixelDialog>
    </main>
  );
}
