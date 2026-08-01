import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { APP_VERSION } from '../shared/version';
import type { AppStatus, DrumulizerAppInfo, LocalAudioFileResult } from '../shared/types/app';
import { audioRuntimeStore } from './audio/runtimeStore';
import { AudioImportError, decodeImportedAudio } from './audio/importAudio';
import { PlaybackEngine } from './audio/playbackEngine';
import { buildWaveformPeaksInWorker } from './audio/peakWorkerClient';
import { OnsetWorkerClient } from './audio/onset/onsetWorkerClient';
import { sliceSetSignature } from './audio/sliceAnalysis/analyzeSlices';
import { calculateEffectiveRole } from './audio/sliceAnalysis/roleScoring';
import { SliceAnalysisWorkerClient } from './audio/sliceAnalysis/sliceAnalysisWorkerClient';
import type {
  SliceAnalysisLifecycle,
  SliceAnalysisResult,
  SliceAnnotationState,
  SliceLibraryFilter,
  SliceLibrarySort,
} from './audio/sliceAnalysis/sliceAnalysisTypes';
import { SequencerEngine } from './sequencer/SequencerEngine';
import {
  clearLane,
  clearPattern,
  createDefaultPattern,
  findEventAt,
  paintEvent,
  reconcilePatternSlices,
  removeEvent,
  removeEventAt,
  resetEventParameters,
  setAllEventLocks,
  setEventLock,
  setLaneState,
  setPatternBars,
  setPatternBpm,
  setPatternSwing,
  updateEvent,
} from './sequencer/patternModel';
import {
  createPatternHistory,
  pushPatternHistory,
  redoPatternHistory,
  undoPatternHistory,
  type PatternHistory,
} from './sequencer/history';
import {
  createDefaultGeneratorSettings,
  createDefaultMutationState,
  normalizeGeneratorSettings,
  type GenerationSummary,
} from './sequencer/generator/generatorTypes';
import { generatePattern } from './sequencer/generator/generatePattern';
import { mutatePattern } from './sequencer/generator/mutatePattern';
import { generatorPrerequisites } from './sequencer/generator/generationDiagnostics';
import {
  applyIDMTransform,
  createDefaultIDMTransformMutationState,
  createDefaultIDMTransformSettings,
  normalizeIDMTransformSettings,
  resetIDMTransforms,
  type IDMTransformSummary,
} from './sequencer/transform/idmTransform';
import type {
  IDMTransformMutationState,
  IDMTransformSettings,
  MainWorkspaceMode,
  PatternGeneratorSettings,
  PatternMutationState,
  SequencerEvent,
  SequencerLaneId,
  SequencerSliceContext,
  SequencerTool,
  SequencerTransportState,
} from './sequencer/types';
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
import { SequencerPanel } from './components/SequencerPanel';
import { SliceLibraryPanel } from './components/SliceLibraryPanel';
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
const sliceAnalysisWorkerClient = new SliceAnalysisWorkerClient();
const sequencerEngine = new SequencerEngine();

const initialSliceState: SliceHistoryState = {
  markers: [],
  selectedMarkerId: null,
  selectedSliceId: '',
};

const initialPatternState = () => ({
  pattern: createDefaultPattern(),
  selectedEventId: null,
});

const initialSequencerTransport = (): SequencerTransportState => sequencerEngine.snapshot();

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
  const [sliceAnalysisResult, setSliceAnalysisResult] = useState<SliceAnalysisResult | null>(null);
  const [sliceAnalysisProgress, setSliceAnalysisProgress] = useState<number | null>(null);
  const [sliceAnalysisRunning, setSliceAnalysisRunning] = useState(false);
  const [sliceAnalysisError, setSliceAnalysisError] = useState<string | null>(null);
  const [sliceAnnotations, setSliceAnnotations] = useState<SliceAnnotationState>({
    overrides: {},
    excluded: {},
  });
  const [sliceLibraryFilter, setSliceLibraryFilter] = useState<SliceLibraryFilter>('all');
  const [sliceLibrarySort, setSliceLibrarySort] = useState<SliceLibrarySort>('index');
  const [workspaceMode, setWorkspaceMode] = useState<MainWorkspaceMode>('library');
  const [activeSliceId, setActiveSliceId] = useState<string | null>(null);
  const [sequencerTool, setSequencerTool] = useState<SequencerTool>('select');
  const [sequencerTransport, setSequencerTransport] =
    useState<SequencerTransportState>(initialSequencerTransport);
  const [focusedSequencerCell, setFocusedSequencerCell] = useState<{
    laneId: SequencerLaneId;
    stepIndex: number;
  }>({ laneId: 'low', stepIndex: 0 });
  const [patternMessage, setPatternMessage] = useState<string | null>(null);
  const [generatorSettings, setGeneratorSettings] = useState<PatternGeneratorSettings>(() =>
    createDefaultGeneratorSettings(),
  );
  const [mutationState, setMutationState] = useState<PatternMutationState>(() =>
    createDefaultMutationState(),
  );
  const [generationSummary, setGenerationSummary] = useState<GenerationSummary | null>(null);
  const [idmSettings, setIDMSettings] = useState<IDMTransformSettings>(() =>
    createDefaultIDMTransformSettings(),
  );
  const [idmMutationState, setIDMMutationState] = useState<IDMTransformMutationState>(() =>
    createDefaultIDMTransformMutationState(),
  );
  const [idmSummary, setIDMSummary] = useState<IDMTransformSummary | null>(null);
  const [patternHistory, setPatternHistory] = useState<PatternHistory>(() =>
    createPatternHistory(initialPatternState()),
  );
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
  const sliceAnalysisGeneration = useRef(0);
  const activeSliceAnalysisRequestId = useRef<string | null>(null);
  const previousSliceSignature = useRef<string | null>(null);
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
  const currentSliceSignature = useMemo(
    () => sliceSetSignature(metadata?.id, slices),
    [metadata?.id, slices],
  );
  const sliceAnalysisLifecycle: SliceAnalysisLifecycle = !metadata
    ? 'unavailable'
    : sliceAnalysisRunning
      ? 'analyzing'
      : sliceAnalysisError
        ? 'error'
        : sliceAnalysisResult?.sourceId === metadata.id &&
            sliceAnalysisResult.sliceSetSignature === currentSliceSignature
          ? 'ready'
          : sliceAnalysisResult?.sourceId === metadata.id
            ? 'stale'
            : 'not-analyzed';
  const selectedSlice =
    slices.find((slice) => slice.id === sliceHistory.present.selectedSliceId) ?? slices[0] ?? null;
  const pattern = patternHistory.present.pattern;
  const selectedEvent =
    pattern.events.find((event) => event.id === patternHistory.present.selectedEventId) ?? null;

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

  const cancelSliceAnalysis = useCallback(() => {
    sliceAnalysisGeneration.current += 1;
    activeSliceAnalysisRequestId.current = null;
    sliceAnalysisWorkerClient.cancel();
    setSliceAnalysisRunning(false);
    setSliceAnalysisProgress(null);
  }, []);

  const resetSliceAnnotations = useCallback(() => {
    setSliceAnnotations({ overrides: {}, excluded: {} });
  }, []);

  const resetPattern = useCallback(() => {
    sequencerEngine.stop();
    setSequencerTransport(sequencerEngine.snapshot());
    setPatternHistory(createPatternHistory(initialPatternState()));
    setActiveSliceId(null);
    setPatternMessage(null);
    setGenerationSummary(null);
    setMutationState(createDefaultMutationState(generatorSettings.seed));
    setIDMSummary(null);
    setIDMMutationState(createDefaultIDMTransformMutationState(idmSettings.seed));
    setFocusedSequencerCell({ laneId: 'low', stepIndex: 0 });
  }, [generatorSettings.seed, idmSettings.seed]);

  const pushPatternEdit = useCallback(
    (
      nextPattern: typeof pattern,
      selectedEventId: string | null,
      message: string | null = null,
    ) => {
      setPatternHistory((history) =>
        pushPatternHistory(history, { pattern: nextPattern, selectedEventId }),
      );
      setPatternMessage(message);
    },
    [],
  );

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
      cancelSliceAnalysis();
      resetSliceAnnotations();
      setSliceAnalysisResult(null);
      setSliceAnalysisError(null);

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
        resetPattern();
        audioRuntimeStore.set(decoded);
        discardOnsetPreview();
        setMetadata(decoded.metadata);
        setPeaks(builtPeaks);
        setPlayback(playbackEngine.load(decoded.originalBuffer));
        setSequencerTransport(sequencerEngine.load(decoded.originalBuffer));
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
      cancelSliceAnalysis,
      discardOnsetPreview,
      initializeSlicesForSource,
      metadata,
      resetViewport,
      resetSliceAnnotations,
      resetPattern,
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
    cancelSliceAnalysis();
    discardOnsetPreview();
    playbackEngine.clear();
    sequencerEngine.clear();
    audioRuntimeStore.clear();
    setMetadata(null);
    setPeaks(null);
    setPlayback(playbackEngine.snapshot());
    setImportState({ status: 'empty' });
    setErrorMessage(null);
    setStatus('ready');
    setSliceHistory(createSliceHistory(initialSliceState));
    resetPattern();
    setSliceAnalysisResult(null);
    setSliceAnalysisError(null);
    resetSliceAnnotations();
    setInlineSliceError(null);
    setInlineSliceMessage(null);
    resetViewport(0);
  }, [
    cancelOnsetAnalysis,
    cancelSliceAnalysis,
    discardOnsetPreview,
    resetSliceAnnotations,
    resetPattern,
    resetViewport,
  ]);

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
    resetSliceAnnotations();
  }, [
    markers,
    metadata,
    onsetApplyMode,
    onsetPreview,
    previewCandidates,
    sampleRate,
    resetSliceAnnotations,
    sourceLengthSamples,
  ]);

  const analyzeCommittedSlices = useCallback(() => {
    const runtime = audioRuntimeStore.get();
    if (!metadata || !runtime || slices.length === 0) return;
    cancelSliceAnalysis();
    const requestId = `slice-analysis-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const generation = sliceAnalysisGeneration.current + 1;
    sliceAnalysisGeneration.current = generation;
    activeSliceAnalysisRequestId.current = requestId;
    setSliceAnalysisRunning(true);
    setSliceAnalysisProgress(0);
    setSliceAnalysisError(null);
    setStatus('processing');

    void sliceAnalysisWorkerClient
      .analyze(
        {
          requestId,
          sourceId: metadata.id,
          sliceSetSignature: currentSliceSignature,
          monoData: runtime.analysisMonoData,
          originalSampleRate: metadata.sampleRate,
          slices,
        },
        (progress) => {
          if (generation !== sliceAnalysisGeneration.current) return;
          setSliceAnalysisProgress(Math.max(0, Math.min(100, Math.round(progress))));
        },
      )
      .then((result) => {
        if (
          generation !== sliceAnalysisGeneration.current ||
          activeSliceAnalysisRequestId.current !== result.requestId ||
          metadata.id !== audioRuntimeStore.get()?.metadata.id ||
          result.sliceSetSignature !== currentSliceSignature
        ) {
          return;
        }
        setSliceAnalysisResult(result);
        setSliceAnalysisRunning(false);
        setSliceAnalysisProgress(null);
        setStatus('ready');
      })
      .catch(() => {
        if (generation !== sliceAnalysisGeneration.current) return;
        setSliceAnalysisRunning(false);
        setSliceAnalysisProgress(null);
        setSliceAnalysisError(t('sliceAnalysis.failed'));
        setStatus('error');
      });
  }, [cancelSliceAnalysis, currentSliceSignature, metadata, slices, t]);

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
      setActiveSliceId(sliceId);
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
    setSequencerTransport(sequencerEngine.stop());
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
    setSequencerTransport(sequencerEngine.stop());
    void playbackEngine
      .auditionCandidate({ sampleIndex: candidate.sampleIndex, sampleRate })
      .then(setPlayback);
  }, [previewCandidates, sampleRate, selectedPreviewCandidateId]);

  const playFullFile = useCallback(() => {
    setSequencerTransport(sequencerEngine.stop());
    void playbackEngine.play().then(setPlayback);
  }, []);

  useEffect(() => {
    const tick = (): void => {
      setPlayback(playbackEngine.snapshot());
      setSequencerTransport(sequencerEngine.snapshot());
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
      onsetWorkerClient.cancel();
      sliceAnalysisWorkerClient.cancel();
      sequencerEngine.clear();
      playbackEngine.clear();
    };
  }, []);

  useEffect(() => {
    if (!metadata) {
      previousSliceSignature.current = null;
      return;
    }
    if (
      previousSliceSignature.current &&
      previousSliceSignature.current !== currentSliceSignature
    ) {
      setSequencerTransport(sequencerEngine.stop());
      setPatternHistory((history) => {
        const result = reconcilePatternSlices({
          pattern: history.present.pattern,
          slices,
          selectedEventId: history.present.selectedEventId,
        });
        if (!result.changed) return history;
        setPatternMessage(t('sequencer.eventsRemoved', { count: result.removedCount ?? 0 }));
        return pushPatternHistory(history, {
          pattern: result.pattern,
          selectedEventId: result.selectedEventId,
        });
      });
      resetSliceAnnotations();
      setPlayback(playbackEngine.stopSliceAudition());
    }
    previousSliceSignature.current = currentSliceSignature;
  }, [currentSliceSignature, metadata, resetSliceAnnotations, slices, t]);

  useEffect(() => {
    setSequencerTransport(sequencerEngine.update(pattern, slices));
  }, [pattern, slices]);

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
      if (event.key.toLowerCase() === 'l' && workspaceMode !== 'sequencer') {
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
    workspaceMode,
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
  const sliceAnalysisById = useMemo(
    () =>
      new Map(
        (sliceAnalysisResult?.analyses ?? []).map((analysis) => [analysis.sliceId, analysis]),
      ),
    [sliceAnalysisResult?.analyses],
  );
  const roleBySliceId = useMemo(() => {
    return Object.fromEntries(
      slices.map((slice) => [
        slice.id,
        calculateEffectiveRole(
          sliceAnalysisById.get(slice.id) ?? null,
          sliceAnnotations.overrides[slice.id],
          Boolean(sliceAnnotations.excluded[slice.id]),
        ),
      ]),
    );
  }, [sliceAnalysisById, sliceAnnotations, slices]);
  const sliceContextById = useMemo(() => {
    return Object.fromEntries(
      slices.map((slice) => {
        const analysis = sliceAnalysisById.get(slice.id) ?? null;
        return [
          slice.id,
          {
            slice,
            effectiveRole: calculateEffectiveRole(
              analysis,
              sliceAnnotations.overrides[slice.id],
              Boolean(sliceAnnotations.excluded[slice.id]),
            ),
            excluded: Boolean(sliceAnnotations.excluded[slice.id]),
            confidence: analysis?.confidence ?? null,
          } satisfies SequencerSliceContext,
        ];
      }),
    );
  }, [sliceAnalysisById, sliceAnnotations, slices]);
  const activeSliceContext = activeSliceId ? (sliceContextById[activeSliceId] ?? null) : null;
  const selectedEventContext = selectedEvent
    ? (sliceContextById[selectedEvent.sliceId] ?? null)
    : null;
  const generatorSliceInput = useMemo(() => {
    const currentAnalysis =
      sliceAnalysisResult &&
      sliceAnalysisResult.sourceId === metadata?.id &&
      sliceAnalysisResult.sliceSetSignature === currentSliceSignature
        ? sliceAnalysisResult
        : null;
    return {
      slices,
      analyses: currentAnalysis?.analyses ?? [],
      annotations: sliceAnnotations,
    };
  }, [currentSliceSignature, metadata?.id, sliceAnalysisResult, sliceAnnotations, slices]);
  const generatorStatus = useMemo(
    () =>
      generatorPrerequisites({
        hasSource: Boolean(metadata),
        slices,
        lifecycle: sliceAnalysisLifecycle,
        transport: sequencerTransport,
        sliceInput: generatorSliceInput,
      }),
    [generatorSliceInput, metadata, sequencerTransport, sliceAnalysisLifecycle, slices],
  );

  const editLocked = sequencerTransport.status !== 'stopped';

  const setPatternPresent = useCallback(
    (nextPattern: typeof pattern, selectedEventId = patternHistory.present.selectedEventId) => {
      setPatternHistory((history) => ({
        ...history,
        present: { pattern: nextPattern, selectedEventId },
      }));
    },
    [patternHistory.present.selectedEventId],
  );

  const handleSequencerGridAction = useCallback(
    (laneId: SequencerLaneId, stepIndex: number) => {
      setFocusedSequencerCell({ laneId, stepIndex });
      if (editLocked) {
        setPatternMessage(t('sequencer.editLocked'));
        return;
      }
      if (sequencerTool === 'select') {
        const event = findEventAt(pattern, laneId, stepIndex);
        setPatternHistory((history) => ({
          ...history,
          present: { ...history.present, selectedEventId: event?.id ?? null },
        }));
        return;
      }
      if (sequencerTool === 'paint') {
        const result = paintEvent({ pattern, laneId, stepIndex, sliceId: activeSliceId });
        if (!result.changed) {
          setPatternMessage(t('sequencer.noActiveSlice'));
          return;
        }
        pushPatternEdit(result.pattern, result.selectedEventId);
        return;
      }
      const event = findEventAt(pattern, laneId, stepIndex);
      const result = removeEventAt(pattern, laneId, stepIndex);
      if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
      else if (!event) setPatternMessage(null);
    },
    [activeSliceId, editLocked, pattern, pushPatternEdit, sequencerTool, t],
  );

  const updateSelectedPatternEvent = useCallback(
    (
      eventId: string,
      patch: Partial<Pick<SequencerEvent, 'velocity' | 'pan' | 'pitchSemitones' | 'transform'>>,
    ) => {
      if (editLocked) {
        setPatternMessage(t('sequencer.editLocked'));
        return;
      }
      if (
        patch.velocity !== undefined ||
        patch.pan !== undefined ||
        patch.pitchSemitones !== undefined ||
        patch.transform !== undefined
      ) {
        const claimed = updateEvent(pattern, eventId, { ...patch, origin: 'manual' });
        if (claimed.changed) pushPatternEdit(claimed.pattern, claimed.selectedEventId);
        return;
      }
      const result = updateEvent(pattern, eventId, patch);
      if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
    },
    [editLocked, pattern, pushPatternEdit, t],
  );

  const replaceSelectedWithActiveSlice = useCallback(() => {
    if (editLocked || !selectedEvent || !activeSliceId) return;
    const result = updateEvent(pattern, selectedEvent.id, {
      sliceId: activeSliceId,
      origin: 'manual',
    });
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
  }, [activeSliceId, editLocked, pattern, pushPatternEdit, selectedEvent]);

  const resetSelectedEvent = useCallback(() => {
    if (editLocked || !selectedEvent) return;
    const result = resetEventParameters(pattern, selectedEvent.id);
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
  }, [editLocked, pattern, pushPatternEdit, selectedEvent]);

  const removeSelectedPatternEvent = useCallback(() => {
    if (editLocked) return;
    const result = removeEvent(pattern, patternHistory.present.selectedEventId);
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
  }, [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit]);

  const clearPatternLane = useCallback(
    (laneId: SequencerLaneId) => {
      if (editLocked) return;
      const result = clearLane(pattern, laneId, patternHistory.present.selectedEventId);
      if (result.changed)
        pushPatternEdit(
          result.pattern,
          result.selectedEventId,
          t('sequencer.eventsRemoved', { count: result.removedCount ?? 0 }),
        );
    },
    [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit, t],
  );

  const clearWholePattern = useCallback(() => {
    if (editLocked) return;
    const result = clearPattern(pattern);
    if (result.changed)
      pushPatternEdit(
        result.pattern,
        result.selectedEventId,
        t('sequencer.eventsRemoved', { count: result.removedCount ?? 0 }),
      );
  }, [editLocked, pattern, pushPatternEdit, t]);

  const playPattern = useCallback(() => {
    const runtime = audioRuntimeStore.get();
    if (!runtime) return;
    setPlayback(playbackEngine.stop());
    void sequencerEngine
      .play({ pattern, slices, seed: generatorSettings.seed })
      .then(setSequencerTransport);
  }, [generatorSettings.seed, pattern, slices]);

  const pausePattern = useCallback(() => {
    setSequencerTransport(sequencerEngine.pause());
  }, []);

  const stopPattern = useCallback(() => {
    setSequencerTransport(sequencerEngine.stop());
  }, []);

  const setPatternLoop = useCallback(
    (enabled: boolean) => {
      setPatternPresent({ ...pattern, loopEnabled: enabled });
    },
    [pattern, setPatternPresent],
  );

  const setLaneMuted = useCallback(
    (laneId: SequencerLaneId, muted: boolean) => {
      setPatternPresent(setLaneState(pattern, laneId, { muted }));
    },
    [pattern, setPatternPresent],
  );

  const setLaneSoloed = useCallback(
    (laneId: SequencerLaneId, soloed: boolean) => {
      setPatternPresent(setLaneState(pattern, laneId, { soloed }));
    },
    [pattern, setPatternPresent],
  );

  const setLaneGain = useCallback(
    (laneId: SequencerLaneId, gainDb: number) => {
      setPatternPresent(setLaneState(pattern, laneId, { gainDb }));
    },
    [pattern, setPatternPresent],
  );

  const setLaneGenerationLocked = useCallback(
    (laneId: SequencerLaneId, generationLocked: boolean) => {
      setPatternPresent(setLaneState(pattern, laneId, { generationLocked }));
    },
    [pattern, setPatternPresent],
  );

  const updateGeneratorSettings = useCallback((settings: PatternGeneratorSettings) => {
    const normalized = normalizeGeneratorSettings(settings);
    setGeneratorSettings(normalized);
    setMutationState(createDefaultMutationState(normalized.seed));
  }, []);

  const updateIDMSettings = useCallback((settings: IDMTransformSettings) => {
    const normalized = normalizeIDMTransformSettings(settings);
    setIDMSettings(normalized);
    setIDMMutationState(createDefaultIDMTransformMutationState(normalized.seed));
  }, []);

  const applyGenerationResult = useCallback(
    (result: ReturnType<typeof generatePattern>) => {
      let finalPattern = result.pattern;
      let selectedEventId = result.selectedEventId;
      if (idmSettings.applyAfterGeneration && idmSettings.intensity > 0) {
        const transformed = applyIDMTransform({
          pattern: finalPattern,
          selectedEventId,
          settings: { ...idmSettings, seed: generatorSettings.seed },
          mutationState: idmMutationState,
          action: 'apply',
        });
        finalPattern = transformed.pattern;
        selectedEventId = transformed.selectedEventId;
        setIDMSummary(transformed.summary);
        setIDMMutationState(transformed.mutationState);
      }
      setGenerationSummary(result.summary);
      setMutationState(result.mutationState);
      if (result.changed) pushPatternEdit(finalPattern, selectedEventId);
      else setPatternMessage(t('generator.noChange'));
    },
    [generatorSettings.seed, idmMutationState, idmSettings, pushPatternEdit, t],
  );

  const generateCurrentPattern = useCallback(() => {
    if (!generatorStatus.ready || editLocked) {
      setPatternMessage(
        t(
          (generatorStatus.reasonKey ?? 'generator.reason.analysisNotReady') as Parameters<
            typeof t
          >[0],
        ),
      );
      return;
    }
    applyGenerationResult(
      generatePattern({
        pattern,
        selectedEventId: patternHistory.present.selectedEventId,
        sliceInput: generatorSliceInput,
        settings: generatorSettings,
        mutationState,
        action: 'generate',
      }),
    );
  }, [
    applyGenerationResult,
    editLocked,
    generatorSettings,
    generatorSliceInput,
    generatorStatus,
    mutationState,
    pattern,
    patternHistory.present.selectedEventId,
    t,
  ]);

  const regenerateUnlockedPattern = useCallback(() => {
    if (!generatorStatus.ready || editLocked) {
      setPatternMessage(
        t(
          (generatorStatus.reasonKey ?? 'generator.reason.analysisNotReady') as Parameters<
            typeof t
          >[0],
        ),
      );
      return;
    }
    applyGenerationResult(
      generatePattern({
        pattern,
        selectedEventId: patternHistory.present.selectedEventId,
        sliceInput: generatorSliceInput,
        settings: { ...generatorSettings, mode: 'replace-unlocked' },
        mutationState,
        action: 'regenerate',
      }),
    );
  }, [
    applyGenerationResult,
    editLocked,
    generatorSettings,
    generatorSliceInput,
    generatorStatus,
    mutationState,
    pattern,
    patternHistory.present.selectedEventId,
    t,
  ]);

  const mutateCurrentPattern = useCallback(() => {
    if (!generatorStatus.ready || editLocked) {
      setPatternMessage(
        t(
          (generatorStatus.reasonKey ?? 'generator.reason.analysisNotReady') as Parameters<
            typeof t
          >[0],
        ),
      );
      return;
    }
    applyGenerationResult(
      mutatePattern({
        pattern,
        selectedEventId: patternHistory.present.selectedEventId,
        sliceInput: generatorSliceInput,
        settings: generatorSettings,
        mutationState,
      }),
    );
  }, [
    applyGenerationResult,
    editLocked,
    generatorSettings,
    generatorSliceInput,
    generatorStatus,
    mutationState,
    pattern,
    patternHistory.present.selectedEventId,
    t,
  ]);

  const randomizeSeed = useCallback(() => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    updateGeneratorSettings({
      ...generatorSettings,
      seed: Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    });
  }, [generatorSettings, updateGeneratorSettings]);

  const copySeed = useCallback(() => {
    void navigator.clipboard?.writeText(generatorSettings.seed);
  }, [generatorSettings.seed]);

  const resetGeneratorSettings = useCallback(() => {
    updateGeneratorSettings(createDefaultGeneratorSettings());
    setGenerationSummary(null);
  }, [updateGeneratorSettings]);

  const toggleSelectedEventLock = useCallback(() => {
    if (editLocked || !selectedEvent) return;
    const result = setEventLock(pattern, selectedEvent.id, !selectedEvent.locked);
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
  }, [editLocked, pattern, pushPatternEdit, selectedEvent]);

  const lockAllEvents = useCallback(() => {
    if (editLocked) return;
    if (!pattern.events.some((event) => !event.locked)) return;
    pushPatternEdit(setAllEventLocks(pattern, true), patternHistory.present.selectedEventId);
  }, [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit]);

  const unlockAllEvents = useCallback(() => {
    if (editLocked) return;
    if (!pattern.events.some((event) => event.locked)) return;
    pushPatternEdit(setAllEventLocks(pattern, false), patternHistory.present.selectedEventId);
  }, [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit]);

  const applyCurrentIDMTransform = useCallback(() => {
    if (editLocked) return;
    const result = applyIDMTransform({
      pattern,
      selectedEventId: patternHistory.present.selectedEventId,
      settings: idmSettings,
      mutationState: idmMutationState,
      action: 'apply',
    });
    setIDMSummary(result.summary);
    setIDMMutationState(result.mutationState);
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
    else setPatternMessage(t('idm.noChange'));
  }, [
    editLocked,
    idmMutationState,
    idmSettings,
    pattern,
    patternHistory.present.selectedEventId,
    pushPatternEdit,
    t,
  ]);

  const mutateCurrentIDMTransform = useCallback(() => {
    if (editLocked) return;
    const result = applyIDMTransform({
      pattern,
      selectedEventId: patternHistory.present.selectedEventId,
      settings: idmSettings,
      mutationState: idmMutationState,
      action: 'mutate',
    });
    setIDMSummary(result.summary);
    setIDMMutationState(result.mutationState);
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
    else setPatternMessage(t('idm.noChange'));
  }, [
    editLocked,
    idmMutationState,
    idmSettings,
    pattern,
    patternHistory.present.selectedEventId,
    pushPatternEdit,
    t,
  ]);

  const resetCurrentIDMTransform = useCallback(() => {
    if (editLocked) return;
    const result = resetIDMTransforms({
      pattern,
      selectedEventId: patternHistory.present.selectedEventId,
      settings: idmSettings,
    });
    setIDMSummary(result.summary);
    setIDMMutationState(result.mutationState);
    if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
    else setPatternMessage(t('idm.noChange'));
  }, [
    editLocked,
    idmSettings,
    pattern,
    patternHistory.present.selectedEventId,
    pushPatternEdit,
    t,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (workspaceMode !== 'sequencer' || isTextInputTarget(event.target)) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key === 'g') {
        event.preventDefault();
        if (event.shiftKey) regenerateUnlockedPattern();
        else generateCurrentPattern();
        return;
      }
      if (key === 'u') {
        event.preventDefault();
        mutateCurrentPattern();
        return;
      }
      if (key === 'l') {
        event.preventDefault();
        toggleSelectedEventLock();
        return;
      }
      if (!selectedEvent || editLocked) return;
      if (key === 'r') {
        event.preventDefault();
        const nextTransform = event.shiftKey
          ? {
              ...selectedEvent.transform,
              ratchetCount:
                selectedEvent.transform.ratchetCount >= 4
                  ? 1
                  : selectedEvent.transform.ratchetCount + 1,
            }
          : { ...selectedEvent.transform, reverse: !selectedEvent.transform.reverse };
        const result = updateEvent(pattern, selectedEvent.id, {
          transform: nextTransform,
          origin: 'manual',
        });
        if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        const current = selectedEvent.transform.probability;
        const probability =
          current > 0.99 ? 0.75 : current > 0.74 ? 0.5 : current > 0.49 ? 0.25 : 1;
        const result = updateEvent(pattern, selectedEvent.id, {
          transform: { ...selectedEvent.transform, probability },
          origin: 'manual',
        });
        if (result.changed) pushPatternEdit(result.pattern, result.selectedEventId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    generateCurrentPattern,
    mutateCurrentPattern,
    editLocked,
    pattern,
    pushPatternEdit,
    regenerateUnlockedPattern,
    selectedEvent,
    toggleSelectedEventLock,
    workspaceMode,
  ]);

  const changePatternBpm = useCallback(
    (bpm: number) => {
      if (editLocked) {
        setPatternMessage(t('sequencer.editLocked'));
        return;
      }
      pushPatternEdit(setPatternBpm(pattern, bpm), patternHistory.present.selectedEventId);
    },
    [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit, t],
  );

  const changePatternSwing = useCallback(
    (swing: number) => {
      if (editLocked) {
        setPatternMessage(t('sequencer.editLocked'));
        return;
      }
      pushPatternEdit(setPatternSwing(pattern, swing), patternHistory.present.selectedEventId);
    },
    [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit, t],
  );

  const changePatternBars = useCallback(
    (bars: number) => {
      if (editLocked) {
        setPatternMessage(t('sequencer.editLocked'));
        return;
      }
      const result = setPatternBars(pattern, bars, patternHistory.present.selectedEventId);
      if (result.changed)
        pushPatternEdit(
          result.pattern,
          result.selectedEventId,
          result.removedCount ? t('sequencer.eventsRemoved', { count: result.removedCount }) : null,
        );
    },
    [editLocked, pattern, patternHistory.present.selectedEventId, pushPatternEdit, t],
  );

  const undoPattern = useCallback(() => {
    if (editLocked) return;
    setPatternHistory((history) => undoPatternHistory(history));
  }, [editLocked]);

  const redoPattern = useCallback(() => {
    if (editLocked) return;
    setPatternHistory((history) => redoPatternHistory(history));
  }, [editLocked]);

  const auditionSelectedEvent = useCallback(() => {
    const runtime = audioRuntimeStore.get();
    if (!runtime || !selectedEvent || !selectedEventContext) return;
    setPlayback(playbackEngine.stop());
    void sequencerEngine
      .auditionEvent({
        event: selectedEvent,
        pattern,
        slices,
        buffer: runtime.originalBuffer,
        masterGain: playback.masterGain,
      })
      .then(() => setSequencerTransport(sequencerEngine.snapshot()));
  }, [pattern, playback.masterGain, selectedEvent, selectedEventContext, slices]);

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
        <span>{t(`sliceAnalysis.status.${sliceAnalysisLifecycle}`)}</span>
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
            roleBySliceId={roleBySliceId}
            onSelectSlice={selectSlice}
          />

          <PixelSectionHeader
            label={t('section.patternWorkspace')}
            code={workspaceMode === 'library' ? t('section.sliceLibrary') : t('section.sequencer')}
          />
          <div className="workspace-switcher">
            <PixelTabs
              tabs={[t('section.sliceLibrary'), t('section.sequencer')]}
              selected={
                workspaceMode === 'library' ? t('section.sliceLibrary') : t('section.sequencer')
              }
              onSelect={(label) =>
                setWorkspaceMode(label === t('section.sequencer') ? 'sequencer' : 'library')
              }
            />
            {workspaceMode === 'library' ? (
              <>
                <SliceLibraryPanel
                  slices={slices}
                  selectedSliceId={selectedSlice?.id ?? null}
                  lifecycle={sliceAnalysisLifecycle}
                  result={sliceAnalysisResult}
                  progress={sliceAnalysisProgress}
                  filter={sliceLibraryFilter}
                  sort={sliceLibrarySort}
                  annotations={sliceAnnotations}
                  onAnalyze={analyzeCommittedSlices}
                  onFilterChange={setSliceLibraryFilter}
                  onSortChange={setSliceLibrarySort}
                  onSelectSlice={selectSlice}
                  onOverride={(sliceId, override) =>
                    setSliceAnnotations((current) => ({
                      ...current,
                      overrides: { ...current.overrides, [sliceId]: override },
                    }))
                  }
                  onExclude={(sliceId, excluded) =>
                    setSliceAnnotations((current) => ({
                      ...current,
                      excluded: { ...current.excluded, [sliceId]: excluded },
                    }))
                  }
                  onResetSelected={(sliceId) =>
                    setSliceAnnotations((current) => {
                      const overrides = { ...current.overrides };
                      const excluded = { ...current.excluded };
                      delete overrides[sliceId];
                      delete excluded[sliceId];
                      return { overrides, excluded };
                    })
                  }
                  onResetAll={resetSliceAnnotations}
                  onIncludeAll={() =>
                    setSliceAnnotations((current) => ({
                      ...current,
                      excluded: {},
                    }))
                  }
                />
                {sliceAnalysisError ? (
                  <p className="analysis-panel__message">{sliceAnalysisError}</p>
                ) : null}
              </>
            ) : (
              <>
                <SequencerPanel
                  pattern={pattern}
                  transport={sequencerTransport}
                  tool={sequencerTool}
                  activeSlice={activeSliceContext}
                  selectedEvent={selectedEvent}
                  selectedEventContext={selectedEventContext}
                  sliceContextById={sliceContextById}
                  selectedEventId={patternHistory.present.selectedEventId}
                  focusedLaneId={focusedSequencerCell.laneId}
                  focusedStepIndex={focusedSequencerCell.stepIndex}
                  masterGain={playback.masterGain}
                  generatorSettings={generatorSettings}
                  mutationState={mutationState}
                  generatorReady={generatorStatus.ready}
                  generatorReason={generatorStatus.reasonKey}
                  generationSummary={generationSummary}
                  idmSettings={idmSettings}
                  idmMutationState={idmMutationState}
                  idmSummary={idmSummary}
                  onToolChange={setSequencerTool}
                  onBpmChange={changePatternBpm}
                  onBarsChange={changePatternBars}
                  onSwingChange={changePatternSwing}
                  onLoopChange={setPatternLoop}
                  onPlay={playPattern}
                  onPause={pausePattern}
                  onStop={stopPattern}
                  onGridAction={handleSequencerGridAction}
                  onFocusCell={(laneId, stepIndex) =>
                    setFocusedSequencerCell({ laneId, stepIndex })
                  }
                  onClearActiveSlice={() => setActiveSliceId(null)}
                  onAuditionActiveSlice={() => {
                    if (!activeSliceContext) return;
                    setSequencerTransport(sequencerEngine.stop());
                    void playbackEngine
                      .auditionSlice({
                        startSeconds: activeSliceContext.slice.startSeconds,
                        endSeconds: activeSliceContext.slice.endSeconds,
                        prerollMs,
                      })
                      .then(setPlayback);
                  }}
                  onLaneMute={setLaneMuted}
                  onLaneSolo={setLaneSoloed}
                  onLaneGain={setLaneGain}
                  onLaneGenerationLock={setLaneGenerationLocked}
                  onClearLane={clearPatternLane}
                  onClearPattern={clearWholePattern}
                  onUndo={undoPattern}
                  onRedo={redoPattern}
                  canUndo={patternHistory.past.length > 0}
                  canRedo={patternHistory.future.length > 0}
                  onUpdateEvent={updateSelectedPatternEvent}
                  onReplaceSelectedEvent={replaceSelectedWithActiveSlice}
                  onResetSelectedEvent={resetSelectedEvent}
                  onRemoveSelectedEvent={removeSelectedPatternEvent}
                  onAuditionSelectedEvent={auditionSelectedEvent}
                  onGeneratorSettingsChange={updateGeneratorSettings}
                  onGeneratePattern={generateCurrentPattern}
                  onRegeneratePattern={regenerateUnlockedPattern}
                  onMutatePattern={mutateCurrentPattern}
                  onRandomizeSeed={randomizeSeed}
                  onCopySeed={copySeed}
                  onResetGeneratorSettings={resetGeneratorSettings}
                  onIDMSettingsChange={updateIDMSettings}
                  onApplyIDMTransform={applyCurrentIDMTransform}
                  onMutateIDMTransform={mutateCurrentIDMTransform}
                  onResetIDMTransform={resetCurrentIDMTransform}
                  onToggleSelectedEventLock={toggleSelectedEventLock}
                  onLockAllEvents={lockAllEvents}
                  onUnlockAllEvents={unlockAllEvents}
                />
                {patternMessage ? (
                  <p className="analysis-panel__message">{patternMessage}</p>
                ) : null}
              </>
            )}
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
