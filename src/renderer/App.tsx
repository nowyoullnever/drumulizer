import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { APP_VERSION } from '../shared/version';
import type { AppStatus, DrumulizerAppInfo, LocalAudioFileResult } from '../shared/types/app';
import { audioRuntimeStore } from './audio/runtimeStore';
import { AudioImportError, decodeImportedAudio } from './audio/importAudio';
import { PlaybackEngine } from './audio/playbackEngine';
import { buildWaveformPeaksInWorker } from './audio/peakWorkerClient';
import { OnsetWorkerClient } from './audio/onset/onsetWorkerClient';
import {
  DEFAULT_ONSET_MINIMUM_GAP_MS,
  DEFAULT_ONSET_SENSITIVITY,
  clampOnsetSettings,
  onsetSettingsKey,
  type OnsetApplyMode,
  type OnsetApplySummary,
  type OnsetDetectionSettings,
  type OnsetPreview,
} from './audio/onset/onsetTypes';
import type {
  AudioImportState,
  AudioSourceMetadata,
  PlaybackSnapshot,
  WaveformPeaks,
} from './audio/types';
import { clamp } from './audio/time';
import { AppStatusModule } from './components/AppStatusModule';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ErrorBanner } from './components/ErrorBanner';
import { LanguageSwitch } from './components/LanguageSwitch';
import { PatternBackground } from './components/PatternBackground';
import { PixelButton } from './components/PixelButton';
import { PixelDialog } from './components/PixelDialog';
import { PixelPanel } from './components/PixelPanel';
import { PixelSectionHeader } from './components/PixelSectionHeader';
import { PixelTabs } from './components/PixelTabs';
import { SelectedSlicePanel } from './components/SelectedSlicePanel';
import { SliceMap } from './components/SliceMap';
import { SliceSetPanel } from './components/SliceSetPanel';
import { SourcePanel } from './components/SourcePanel';
import { TransportControls } from './components/TransportControls';
import { WaveformCanvas } from './components/WaveformCanvas';
import { errorKeyForCode, type UserFacingErrorCode } from './i18n/errorMessages';
import { useI18n } from './i18n/useI18n';
import {
  addMarker,
  applyDetectedCandidates,
  deleteMarker,
  deriveBoundaries,
  deriveSlices,
  equalDivide,
  findSliceBySample,
  moveMarker,
  resetMarkers,
} from './slice/sliceModel';
import {
  createSliceHistory,
  pushSliceHistory,
  redoSliceHistory,
  undoSliceHistory,
  type SliceHistory,
} from './slice/history';
import type {
  SliceEditErrorCode,
  SliceHistoryState,
  SliceMarker,
  SliceRegion,
  WaveformTool,
} from './slice/types';

const fallbackInfo: DrumulizerAppInfo = {
  name: 'Drumulizer',
  version: APP_VERSION,
  platform: 'renderer-preview',
};

const playbackEngine = new PlaybackEngine();
const onsetWorkerClient = new OnsetWorkerClient();

const initialSliceState: SliceHistoryState = {
  markers: [],
  selectedMarkerId: null,
  selectedSliceId: '',
};

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

const isTextInputTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return (
    element?.tagName === 'INPUT' ||
    element?.tagName === 'TEXTAREA' ||
    element?.tagName === 'SELECT' ||
    Boolean(element?.isContentEditable)
  );
};

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
  const [tool, setTool] = useState<WaveformTool>('select');
  const [zeroCrossingEnabled, setZeroCrossingEnabled] = useState(true);
  const [customDivision, setCustomDivision] = useState(8);
  const [prerollMs, setPrerollMs] = useState(0);
  const [onsetSettings, setOnsetSettings] = useState<OnsetDetectionSettings>({
    sensitivity: DEFAULT_ONSET_SENSITIVITY,
    minimumGapMs: DEFAULT_ONSET_MINIMUM_GAP_MS,
  });
  const [onsetPreview, setOnsetPreview] = useState<OnsetPreview | null>(null);
  const [selectedPreviewCandidateId, setSelectedPreviewCandidateId] = useState<string | null>(null);
  const [onsetApplyMode, setOnsetApplyMode] = useState<OnsetApplyMode>('replace');
  const [onsetProgress, setOnsetProgress] = useState<number | null>(null);
  const [onsetAnalyzing, setOnsetAnalyzing] = useState(false);
  const [onsetApplySummary, setOnsetApplySummary] = useState<OnsetApplySummary | null>(null);
  const [inlineSliceError, setInlineSliceError] = useState<SliceEditErrorCode | null>(null);
  const [inlineSliceMessage, setInlineSliceMessage] = useState<string | null>(null);
  const [sliceHistory, setSliceHistory] = useState<SliceHistory>(() =>
    createSliceHistory(initialSliceState),
  );
  const [zoom, setZoom] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const importGeneration = useRef(0);
  const onsetGeneration = useRef(0);
  const activeOnsetRequestId = useRef<string | null>(null);
  const animationFrame = useRef<number | null>(null);
  const dragStartState = useRef<SliceHistoryState | null>(null);
  const appInfo = useMemo(() => window.drumulizer?.getAppInfo() ?? fallbackInfo, []);

  const duration = metadata?.durationSeconds ?? 0;
  const sampleRate = metadata?.sampleRate ?? 1;
  const sourceLengthSamples = metadata ? Math.max(1, Math.round(duration * sampleRate)) : 0;
  const viewportDuration = duration > 0 ? duration / zoom : 1;
  const viewportEnd = Math.min(duration, viewportStart + viewportDuration);
  const markers = sliceHistory.present.markers;
  const previewCandidates = useMemo(() => {
    const preview = onsetPreview;
    if (!preview) return [];
    return preview.sourceId === metadata?.id &&
      preview.settingsKey === onsetSettingsKey(onsetSettings)
      ? preview.candidates
      : [];
  }, [metadata?.id, onsetPreview, onsetSettings]);
  const boundaries = useMemo(
    () => deriveBoundaries(markers, sourceLengthSamples),
    [markers, sourceLengthSamples],
  );
  const slices = useMemo(
    () => deriveSlices(markers, sourceLengthSamples, sampleRate),
    [markers, sampleRate, sourceLengthSamples],
  );
  const selectedSlice =
    slices.find((slice) => slice.id === sliceHistory.present.selectedSliceId) ?? slices[0] ?? null;

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

  const discardOnsetPreview = useCallback(() => {
    setOnsetPreview(null);
    setSelectedPreviewCandidateId(null);
    setOnsetProgress(null);
    setOnsetApplySummary(null);
    setPlayback(playbackEngine.stopCandidateAudition());
  }, []);

  const cancelOnsetAnalysis = useCallback(() => {
    onsetGeneration.current += 1;
    activeOnsetRequestId.current = null;
    onsetWorkerClient.cancel();
    setOnsetAnalyzing(false);
    setOnsetProgress(null);
  }, []);

  const replaceSliceHistory = useCallback((next: SliceHistoryState, push = true) => {
    setSliceHistory((history) =>
      push ? pushSliceHistory(history, next) : { ...history, present: next },
    );
  }, []);

  const commitSliceResult = useCallback(
    (result: {
      markers: SliceMarker[];
      selectedMarkerId: string | null;
      selectedSliceId: string;
      errorCode?: SliceEditErrorCode;
    }) => {
      if (result.errorCode) {
        setInlineSliceError(result.errorCode);
        return;
      }
      setInlineSliceError(null);
      setInlineSliceMessage(null);
      replaceSliceHistory({
        markers: result.markers,
        selectedMarkerId: result.selectedMarkerId,
        selectedSliceId: result.selectedSliceId,
      });
    },
    [replaceSliceHistory],
  );

  const initializeSlicesForSource = useCallback(
    (nextSourceLength: number, nextSampleRate: number) => {
      const slicesForSource = deriveSlices([], nextSourceLength, nextSampleRate);
      setSliceHistory(
        createSliceHistory({
          markers: [],
          selectedMarkerId: null,
          selectedSliceId: slicesForSource[0]?.id ?? '',
        }),
      );
      setInlineSliceError(null);
      setInlineSliceMessage(null);
    },
    [],
  );

  const importAudio = useCallback(
    async (resultPromise: Promise<LocalAudioFileResult>, label = t('source.open')) => {
      const generation = importGeneration.current + 1;
      importGeneration.current = generation;
      setErrorMessage(null);
      setStatus('processing');
      setImportState({ status: 'reading', fileName: label });
      cancelOnsetAnalysis();

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
        discardOnsetPreview();
        setMetadata(decoded.metadata);
        setPeaks(builtPeaks);
        setPlayback(playbackEngine.load(decoded.originalBuffer));
        initializeSlicesForSource(decoded.originalBuffer.length, decoded.metadata.sampleRate);
        resetViewport(decoded.metadata.durationSeconds);
        setImportState({ status: 'ready', sourceId: decoded.metadata.id });
        setStatus('ready');
      } catch (error) {
        applyImportError(error instanceof AudioImportError ? error.code : 'UNKNOWN_IMPORT');
      }
    },
    [
      applyImportError,
      cancelOnsetAnalysis,
      discardOnsetPreview,
      initializeSlicesForSource,
      metadata,
      resetViewport,
      t,
    ],
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
    cancelOnsetAnalysis();
    discardOnsetPreview();
    playbackEngine.clear();
    audioRuntimeStore.clear();
    setMetadata(null);
    setPeaks(null);
    setPlayback(playbackEngine.snapshot());
    setImportState({ status: 'empty' });
    setErrorMessage(null);
    setStatus('ready');
    setSliceHistory(createSliceHistory(initialSliceState));
    setInlineSliceError(null);
    setInlineSliceMessage(null);
    resetViewport(0);
  }, [cancelOnsetAnalysis, discardOnsetPreview, resetViewport]);

  const updateOnsetSettings = useCallback(
    (settings: OnsetDetectionSettings) => {
      setOnsetSettings(clampOnsetSettings(settings));
      discardOnsetPreview();
    },
    [discardOnsetPreview],
  );

  const analyzeOnsets = useCallback(() => {
    const runtime = audioRuntimeStore.get();
    if (!metadata || !runtime) return;
    cancelOnsetAnalysis();
    discardOnsetPreview();
    const requestId = `onset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const settings = clampOnsetSettings(onsetSettings);
    const settingsKey = onsetSettingsKey(settings);
    const generation = onsetGeneration.current + 1;
    onsetGeneration.current = generation;
    activeOnsetRequestId.current = requestId;
    setOnsetAnalyzing(true);
    setStatus('processing');
    setErrorMessage(null);

    void onsetWorkerClient
      .analyze(
        {
          requestId,
          monoData: runtime.analysisMonoData,
          originalSampleRate: metadata.sampleRate,
          settings,
        },
        (progress) => {
          if (generation !== onsetGeneration.current) return;
          setOnsetProgress(Math.max(0, Math.min(100, Math.round(progress))));
        },
      )
      .then((result) => {
        if (
          generation !== onsetGeneration.current ||
          activeOnsetRequestId.current !== result.requestId ||
          metadata.id !== audioRuntimeStore.get()?.metadata.id ||
          settingsKey !== onsetSettingsKey(result.settings)
        ) {
          return;
        }
        setOnsetPreview({
          sourceId: metadata.id,
          requestId: result.requestId,
          settingsKey,
          candidates: result.candidates,
          capped: result.capped,
          diagnostics: result.diagnostics,
          reason: result.reason,
        });
        setSelectedPreviewCandidateId(result.candidates[0]?.id ?? null);
        setOnsetApplySummary(null);
        setOnsetAnalyzing(false);
        setOnsetProgress(null);
        setStatus('ready');
      })
      .catch(() => {
        if (generation !== onsetGeneration.current) return;
        setOnsetAnalyzing(false);
        setOnsetProgress(null);
        setErrorMessage(t('analysis.failed'));
        setStatus('error');
      });
  }, [cancelOnsetAnalysis, discardOnsetPreview, metadata, onsetSettings, t]);

  const applyOnsetPreview = useCallback(() => {
    if (!metadata || previewCandidates.length === 0) return;
    if (!onsetPreview || onsetPreview.sourceId !== metadata.id) return;
    const result = applyDetectedCandidates({
      markers,
      candidates: previewCandidates,
      mode: onsetApplyMode,
      sourceLengthSamples,
      sampleRate,
    });
    setSliceHistory((history) =>
      pushSliceHistory(history, {
        markers: result.markers,
        selectedMarkerId: result.selectedMarkerId,
        selectedSliceId: result.selectedSliceId,
      }),
    );
    setOnsetApplySummary(result.summary);
    setOnsetPreview(null);
    setSelectedPreviewCandidateId(null);
    setStatus('ready');
    setPlayback(playbackEngine.stopSliceAudition());
  }, [
    markers,
    metadata,
    onsetApplyMode,
    onsetPreview,
    previewCandidates,
    sampleRate,
    sourceLengthSamples,
  ]);

  const setViewportSafely = useCallback(
    (start: number, nextZoom = zoom) => {
      const nextDuration = duration > 0 ? duration / nextZoom : 1;
      setViewportStart(clamp(start, 0, Math.max(0, duration - nextDuration)));
    },
    [duration, zoom],
  );

  const revealSlice = useCallback(
    (slice: SliceRegion | null) => {
      if (!slice || duration <= 0) return;
      if (slice.startSeconds >= viewportStart && slice.endSeconds <= viewportEnd) return;
      setViewportSafely(slice.startSeconds, zoom);
    },
    [duration, setViewportSafely, viewportEnd, viewportStart, zoom],
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

  const selectSlice = useCallback(
    (sliceId: string) => {
      const slice = slices.find((candidate) => candidate.id === sliceId);
      setSliceHistory((history) => ({
        ...history,
        present: {
          ...history.present,
          selectedMarkerId: null,
          selectedSliceId: sliceId,
        },
      }));
      revealSlice(slice ?? null);
    },
    [revealSlice, slices],
  );

  const selectSliceAtSample = useCallback(
    (sampleIndex: number) => {
      const slice = findSliceBySample(slices, sampleIndex);
      if (slice) selectSlice(slice.id);
    },
    [selectSlice, slices],
  );

  const selectMarker = useCallback(
    (markerId: string | null) => {
      const nextSliceId =
        markerId && slices.find((slice) => slice.leftBoundaryId === markerId)?.id
          ? slices.find((slice) => slice.leftBoundaryId === markerId)?.id
          : (selectedSlice?.id ?? slices[0]?.id ?? '');
      setSliceHistory((history) => ({
        ...history,
        present: {
          ...history.present,
          selectedMarkerId: markerId,
          selectedSliceId: nextSliceId ?? '',
        },
      }));
    },
    [selectedSlice?.id, slices],
  );

  const addMarkerAtSample = useCallback(
    (sampleIndex: number) => {
      const runtime = audioRuntimeStore.get();
      const result = addMarker({
        markers,
        requestedSample: sampleIndex,
        sourceLengthSamples,
        sampleRate,
        analysisMonoData: runtime?.analysisMonoData,
        zeroCrossingEnabled,
      });
      commitSliceResult(result);
    },
    [commitSliceResult, markers, sampleRate, sourceLengthSamples, zeroCrossingEnabled],
  );

  const moveMarkerPreview = useCallback(
    (markerId: string, sampleIndex: number) => {
      if (!dragStartState.current) dragStartState.current = sliceHistory.present;
      const result = moveMarker({
        markers,
        markerId,
        requestedSample: sampleIndex,
        sourceLengthSamples,
        sampleRate,
        zeroCrossingEnabled: false,
      });
      if (result.errorCode) return;
      replaceSliceHistory(
        {
          markers: result.markers,
          selectedMarkerId: result.selectedMarkerId,
          selectedSliceId: result.selectedSliceId,
        },
        false,
      );
    },
    [markers, replaceSliceHistory, sampleRate, sliceHistory.present, sourceLengthSamples],
  );

  const moveMarkerCommit = useCallback(
    (markerId: string, sampleIndex: number) => {
      const runtime = audioRuntimeStore.get();
      const baseState = dragStartState.current ?? sliceHistory.present;
      const result = moveMarker({
        markers: baseState.markers,
        markerId,
        requestedSample: sampleIndex,
        sourceLengthSamples,
        sampleRate,
        analysisMonoData: runtime?.analysisMonoData,
        zeroCrossingEnabled,
      });
      dragStartState.current = null;
      if (result.errorCode) {
        setInlineSliceError(result.errorCode);
        return;
      }
      setInlineSliceError(null);
      setInlineSliceMessage(
        t('slice.inlineMarkerMoved', {
          sample: result.markers.find((m) => m.id === markerId)?.sampleIndex ?? sampleIndex,
        }),
      );
      setSliceHistory((history) =>
        pushSliceHistory(
          { ...history, present: baseState },
          {
            markers: result.markers,
            selectedMarkerId: result.selectedMarkerId,
            selectedSliceId: result.selectedSliceId,
          },
        ),
      );
      setPlayback(playbackEngine.stopSliceAudition());
    },
    [sampleRate, sliceHistory.present, sourceLengthSamples, t, zeroCrossingEnabled],
  );

  const deleteSelectedMarker = useCallback(() => {
    const result = deleteMarker({
      markers,
      markerId: sliceHistory.present.selectedMarkerId,
      sourceLengthSamples,
      sampleRate,
    });
    commitSliceResult(result);
    setPlayback(playbackEngine.stopSliceAudition());
  }, [
    commitSliceResult,
    markers,
    sampleRate,
    sliceHistory.present.selectedMarkerId,
    sourceLengthSamples,
  ]);

  const resetSliceMarkers = useCallback(() => {
    const result = resetMarkers(sourceLengthSamples, sampleRate);
    commitSliceResult(result);
    setPlayback(playbackEngine.stopSliceAudition());
  }, [commitSliceResult, sampleRate, sourceLengthSamples]);

  const applyEqualDivision = useCallback(
    (count: number) => {
      const result = equalDivide({ sliceCount: count, sourceLengthSamples, sampleRate });
      commitSliceResult(result);
      setPlayback(playbackEngine.stopSliceAudition());
    },
    [commitSliceResult, sampleRate, sourceLengthSamples],
  );

  const undo = useCallback(() => {
    setSliceHistory((history) => undoSliceHistory(history));
    setInlineSliceError(null);
    setPlayback(playbackEngine.stopSliceAudition());
  }, []);

  const redo = useCallback(() => {
    setSliceHistory((history) => redoSliceHistory(history));
    setInlineSliceError(null);
    setPlayback(playbackEngine.stopSliceAudition());
  }, []);

  const previousSlice = useCallback(() => {
    if (!selectedSlice || selectedSlice.index <= 0) return;
    selectSlice(slices[selectedSlice.index - 1].id);
  }, [selectSlice, selectedSlice, slices]);

  const nextSlice = useCallback(() => {
    if (!selectedSlice || selectedSlice.index >= slices.length - 1) return;
    selectSlice(slices[selectedSlice.index + 1].id);
  }, [selectSlice, selectedSlice, slices]);

  const auditionSelectedSlice = useCallback(() => {
    if (!selectedSlice) return;
    void playbackEngine
      .auditionSlice({
        startSeconds: selectedSlice.startSeconds,
        endSeconds: selectedSlice.endSeconds,
        prerollMs,
      })
      .then(setPlayback);
  }, [prerollMs, selectedSlice]);

  const revealPreviewCandidate = useCallback(
    (candidateId: string | null) => {
      const candidate = previewCandidates.find((preview) => preview.id === candidateId);
      if (!candidate || duration <= 0) return;
      const seconds = candidate.sampleIndex / sampleRate;
      if (seconds >= viewportStart && seconds <= viewportEnd) return;
      setViewportSafely(seconds - viewportDuration / 2, zoom);
    },
    [
      duration,
      previewCandidates,
      sampleRate,
      setViewportSafely,
      viewportDuration,
      viewportEnd,
      viewportStart,
      zoom,
    ],
  );

  const selectPreviewCandidate = useCallback(
    (candidateId: string | null) => {
      setSelectedPreviewCandidateId(candidateId);
      if (candidateId) revealPreviewCandidate(candidateId);
    },
    [revealPreviewCandidate],
  );

  const previousPreviewCandidate = useCallback(() => {
    const index = previewCandidates.findIndex(
      (candidate) => candidate.id === selectedPreviewCandidateId,
    );
    if (index <= 0) return;
    selectPreviewCandidate(previewCandidates[index - 1].id);
  }, [previewCandidates, selectPreviewCandidate, selectedPreviewCandidateId]);

  const nextPreviewCandidate = useCallback(() => {
    const index = previewCandidates.findIndex(
      (candidate) => candidate.id === selectedPreviewCandidateId,
    );
    if (index < 0 || index >= previewCandidates.length - 1) return;
    selectPreviewCandidate(previewCandidates[index + 1].id);
  }, [previewCandidates, selectPreviewCandidate, selectedPreviewCandidateId]);

  const auditionPreviewCandidate = useCallback(() => {
    const candidate = previewCandidates.find(
      (preview) => preview.id === selectedPreviewCandidateId,
    );
    if (!candidate) return;
    void playbackEngine
      .auditionCandidate({ sampleIndex: candidate.sampleIndex, sampleRate })
      .then(setPlayback);
  }, [previewCandidates, sampleRate, selectedPreviewCandidateId]);

  const playFullFile = useCallback(() => {
    void playbackEngine.play().then(setPlayback);
  }, []);

  useEffect(() => {
    const tick = (): void => {
      setPlayback(playbackEngine.snapshot());
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
      onsetWorkerClient.cancel();
      playbackEngine.clear();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextInputTarget(event.target)) return;
      if (!metadata) return;

      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (sliceHistory.present.selectedMarkerId) {
          event.preventDefault();
          deleteSelectedMarker();
        }
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        previousSlice();
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        nextSlice();
        return;
      }
      if (event.key === ',') {
        event.preventDefault();
        previousPreviewCandidate();
        return;
      }
      if (event.key === '.') {
        event.preventDefault();
        nextPreviewCandidate();
        return;
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        auditionSelectedSlice();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setPlayback(playbackEngine.stopSliceAudition());
        return;
      }
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setTool((current) => (current === 'select' ? 'add-marker' : 'select'));
        return;
      }

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
  }, [
    auditionSelectedSlice,
    deleteSelectedMarker,
    metadata,
    nextSlice,
    nextPreviewCandidate,
    playback.loopEnabled,
    playback.positionSeconds,
    playback.status,
    previousSlice,
    previousPreviewCandidate,
    redo,
    sliceHistory.present.selectedMarkerId,
    undo,
  ]);

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

          <PixelPanel title={t('panel.sliceSet')} accent="mustard">
            <SliceSetPanel
              markerCount={markers.length}
              sliceCount={slices.length}
              tool={tool}
              canEdit={Boolean(metadata) && !isBusy}
              canUndo={sliceHistory.past.length > 0}
              canRedo={sliceHistory.future.length > 0}
              canReset={markers.length > 0}
              zeroCrossingEnabled={zeroCrossingEnabled}
              customDivision={customDivision}
              inlineError={inlineSliceError}
              inlineMessage={
                tool === 'add-marker' ? t('slice.inlineAddMarker') : inlineSliceMessage
              }
              onToolChange={setTool}
              onUndo={undo}
              onRedo={redo}
              onReset={resetSliceMarkers}
              onZeroCrossingChange={setZeroCrossingEnabled}
              onEqualDivide={applyEqualDivision}
              onCustomDivisionChange={setCustomDivision}
            />
          </PixelPanel>

          <PixelPanel title={t('panel.analysis')} accent="violet">
            <AnalysisPanel
              hasSource={Boolean(metadata) && !isBusy}
              settings={onsetSettings}
              analyzing={onsetAnalyzing}
              progress={onsetProgress}
              candidates={previewCandidates}
              selectedCandidateId={selectedPreviewCandidateId}
              diagnostics={onsetPreview?.diagnostics ?? null}
              applyMode={onsetApplyMode}
              resultReason={onsetPreview?.reason ?? null}
              applySummary={onsetApplySummary}
              onSettingsChange={updateOnsetSettings}
              onAnalyze={analyzeOnsets}
              onApplyModeChange={setOnsetApplyMode}
              onPreviousCandidate={previousPreviewCandidate}
              onNextCandidate={nextPreviewCandidate}
              onAuditionCandidate={auditionPreviewCandidate}
              onStopCandidateAudition={() => setPlayback(playbackEngine.stopCandidateAudition())}
              onApply={applyOnsetPreview}
              onDiscard={discardOnsetPreview}
            />
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
              sourceLengthSamples={sourceLengthSamples}
              sampleRate={sampleRate}
              boundaries={boundaries}
              selectedMarkerId={sliceHistory.present.selectedMarkerId}
              selectedSlice={selectedSlice}
              previewCandidates={previewCandidates}
              selectedPreviewCandidateId={selectedPreviewCandidateId}
              tool={tool}
              onSeek={seek}
              onPan={(delta) => setViewportSafely(viewportStart + delta)}
              onWheelZoom={(factor, anchor) => setZoomSafely(zoom * factor, anchor)}
              onSelectSliceAtSample={selectSliceAtSample}
              onSelectMarker={selectMarker}
              onSelectPreviewCandidate={selectPreviewCandidate}
              onAddMarker={addMarkerAtSample}
              onMoveMarkerPreview={moveMarkerPreview}
              onMoveMarkerCommit={moveMarkerCommit}
            />
          </div>

          <PixelSectionHeader label={t('section.sliceMap')} code={`${slices.length}`} />
          <SliceMap
            slices={slices}
            selectedSliceId={selectedSlice?.id ?? null}
            onSelectSlice={selectSlice}
          />

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
              onPlay={playFullFile}
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

          <PixelPanel title={t('panel.selectedSlice')} accent="cobalt">
            <SelectedSlicePanel
              slice={selectedSlice}
              sliceCount={slices.length}
              selectedMarkerId={sliceHistory.present.selectedMarkerId}
              prerollMs={prerollMs}
              hasSource={Boolean(metadata)}
              onPrevious={previousSlice}
              onNext={nextSlice}
              onAudition={auditionSelectedSlice}
              onStopAudition={() => setPlayback(playbackEngine.stopSliceAudition())}
              onPrerollChange={setPrerollMs}
              onDeleteMarker={deleteSelectedMarker}
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
