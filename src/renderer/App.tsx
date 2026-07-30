import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { APP_VERSION } from '../shared/version';
import type { AppStatus, DrumulizerAppInfo, LocalAudioFileResult } from '../shared/types/app';
import { audioRuntimeStore } from './audio/runtimeStore';
import { AudioImportError, decodeImportedAudio } from './audio/importAudio';
import { PlaybackEngine } from './audio/playbackEngine';
import { buildWaveformPeaksInWorker } from './audio/peakWorkerClient';
import type {
  AudioImportState,
  AudioSourceMetadata,
  PlaybackSnapshot,
  WaveformPeaks,
} from './audio/types';
import { clamp } from './audio/time';
import { AppStatusModule } from './components/AppStatusModule';
import { ErrorBanner } from './components/ErrorBanner';
import { LanguageSwitch } from './components/LanguageSwitch';
import { PatternBackground } from './components/PatternBackground';
import { PixelButton } from './components/PixelButton';
import { PixelDialog } from './components/PixelDialog';
import { PixelPanel } from './components/PixelPanel';
import { PixelSectionHeader } from './components/PixelSectionHeader';
import { PixelTabs } from './components/PixelTabs';
import { SourcePanel } from './components/SourcePanel';
import { TransportControls } from './components/TransportControls';
import { WaveformCanvas } from './components/WaveformCanvas';
import { errorKeyForCode, type UserFacingErrorCode } from './i18n/errorMessages';
import { useI18n } from './i18n/useI18n';

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
  const { t } = useI18n();
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

  const errorMessageForCode = useCallback(
    (code: UserFacingErrorCode) => t(errorKeyForCode(code)),
    [t],
  );

  const applyImportError = useCallback(
    (code: UserFacingErrorCode) => {
      const message = errorMessageForCode(code);
      setErrorMessage(message);
      setImportState({ status: 'error', message });
      setStatus('error');
    },
    [errorMessageForCode],
  );

  const resetViewport = useCallback((newDuration: number) => {
    setZoom(1);
    setViewportStart(0);
    if (newDuration <= 0) setPeaks(null);
  }, []);

  const importAudio = useCallback(
    async (resultPromise: Promise<LocalAudioFileResult>, label = t('source.open')) => {
      const generation = importGeneration.current + 1;
      importGeneration.current = generation;
      setErrorMessage(null);
      setStatus('processing');
      setImportState({ status: 'reading', fileName: label });

      const result = await resultPromise;
      if (generation !== importGeneration.current) return;
      if (result.canceled) {
        setImportState(metadata ? { status: 'ready', sourceId: metadata.id } : { status: 'empty' });
        setStatus('ready');
        return;
      }
      if (result.errorCode) {
        applyImportError(result.errorCode);
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
        applyImportError(error instanceof AudioImportError ? error.code : 'UNKNOWN_IMPORT');
      }
    },
    [applyImportError, metadata, resetViewport, t],
  );

  const openFile = useCallback(() => {
    if (window.drumulizer) {
      void importAudio(window.drumulizer.selectLocalAudioFile(), t('source.open'));
      return;
    }
    if (import.meta.env.DEV) {
      void importAudio(selectFileInRendererPreview(), t('source.open'));
    }
  }, [importAudio, t]);

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
    (event: DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) {
        applyImportError('MULTIPLE_FILES');
        return;
      }
      const [file] = files;
      if (!file || file.size === 0) {
        applyImportError('EMPTY_FILE');
        return;
      }
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'wav' && extension !== 'mp3') {
        applyImportError('UNSUPPORTED_EXTENSION');
        return;
      }
      void importAudio(makeDroppedAudioResult(file), file.name);
    },
    [applyImportError, importAudio],
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
          <p>{t('app.subtitle')}</p>
        </div>
        <div className="identity-strip__controls">
          <AppStatusModule status={status} />
          <LanguageSwitch />
          <PixelButton onClick={() => setAboutOpen(true)}>{t('app.about')}</PixelButton>
        </div>
      </header>

      <section className="project-status">
        <strong>{t('app.workspace')}</strong>
        <span>{metadata ? metadata.fileName : t('app.noSample')}</span>
        <span>{t('app.analysisPending')}</span>
        <span>{t('app.patternEngine')}</span>
      </section>

      {errorMessage ? <ErrorBanner title={t('app.errorTitle')} message={errorMessage} /> : null}

      <div className="workspace-grid workspace-grid--audio">
        <aside className="left-rail">
          <PixelPanel title={t('panel.source')} accent="tomato">
            <SourcePanel
              metadata={metadata}
              importState={importState}
              onOpen={openFile}
              onClear={clearSource}
              disabled={isBusy}
            />
          </PixelPanel>

          <PixelPanel title={t('panel.analysis')} accent="mustard">
            <div className="status-stack">
              <strong className="muted-label">{t('analysis.disabledLabel')}</strong>
              <p>{t('analysis.disabled')}</p>
            </div>
          </PixelPanel>
        </aside>

        <section className="main-workspace">
          <PixelSectionHeader
            label={t('section.waveform')}
            code={metadata ? metadata.channelLabel : t('section.empty')}
          />
          <div className="waveform-shell">
            {isBusy ? (
              <div className="loading-strip" role="status">
                <span>
                  {importState.status === 'decoding'
                    ? t('loading.decoding')
                    : importState.status === 'building-waveform'
                      ? t('loading.building')
                      : t('loading.reading')}
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

          <PixelSectionHeader label={t('section.pattern')} code={t('pattern.disabledCode')} />
          <div className="pattern-workspace pattern-workspace--disabled">
            <PixelTabs
              tabs={['LOW', 'MID', 'HIGH', 'TEXTURE']}
              selected={selectedTab}
              onSelect={setSelectedTab}
            />
            <div className={`lane-preview lane-preview--${selectedTab.toLowerCase()}`}>
              <strong>{t('pattern.previewTitle')}</strong>
              <span>{t('pattern.previewBody')}</span>
            </div>
          </div>
        </section>

        <aside className="control-rail">
          <PixelPanel title={t('panel.transport')} accent="teal">
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
          <strong>{t('drag.title')}</strong>
          <span>{t('drag.body')}</span>
        </div>
      ) : null}

      <PixelDialog
        open={aboutOpen}
        title={t('app.aboutTitle')}
        closeLabel={t('dialog.close')}
        onClose={() => setAboutOpen(false)}
      >
        <p>{t('app.aboutIntro', { version: appInfo.version })}</p>
        <p>{t('app.aboutOffline')}</p>
        <p>{t('app.aboutShortcuts')}</p>
        <p>{t('app.aboutTypeface')}</p>
        <p>{t('app.repository')}</p>
      </PixelDialog>
    </main>
  );
}
