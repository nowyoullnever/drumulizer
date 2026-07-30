import { useEffect, useRef } from 'react';
import type { PlaybackSnapshot, WaveformPeaks } from '../audio/types';
import type { OnsetCandidate } from '../audio/onset/onsetTypes';
import { clamp } from '../audio/time';
import { sourceEndBoundaryId, sourceStartBoundaryId } from '../slice/sliceModel';
import type { SliceBoundary, SliceRegion, WaveformTool } from '../slice/types';
import { useI18n } from '../i18n/useI18n';

interface WaveformCanvasProps {
  peaks: WaveformPeaks | null;
  playback: PlaybackSnapshot;
  viewportStart: number;
  viewportDuration: number;
  sourceLengthSamples: number;
  sampleRate: number;
  boundaries: SliceBoundary[];
  selectedMarkerId: string | null;
  selectedSlice: SliceRegion | null;
  previewCandidates: OnsetCandidate[];
  tool: WaveformTool;
  onSeek: (time: number) => void;
  onPan: (deltaSeconds: number) => void;
  onWheelZoom: (zoomFactor: number, anchorSeconds: number) => void;
  onSelectSliceAtSample: (sampleIndex: number) => void;
  onSelectMarker: (markerId: string | null) => void;
  onAddMarker: (sampleIndex: number) => void;
  onMoveMarkerPreview: (markerId: string, sampleIndex: number) => void;
  onMoveMarkerCommit: (markerId: string, sampleIndex: number) => void;
}

const markerHitWidth = 12;

export function WaveformCanvas({
  peaks,
  playback,
  viewportStart,
  viewportDuration,
  sourceLengthSamples,
  sampleRate,
  boundaries,
  selectedMarkerId,
  selectedSlice,
  previewCandidates,
  tool,
  onSeek,
  onPan,
  onWheelZoom,
  onSelectSliceAtSample,
  onSelectMarker,
  onAddMarker,
  onMoveMarkerPreview,
  onMoveMarkerCommit,
}: WaveformCanvasProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<
    | { type: 'pan'; x: number; start: number }
    | { type: 'marker'; id: string; committed: boolean }
    | null
  >(null);

  const viewportEnd = viewportStart + viewportDuration;

  const secondsFromClientX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    return viewportStart + (x / rect.width) * viewportDuration;
  };

  const sampleFromClientX = (clientX: number): number =>
    Math.round(secondsFromClientX(clientX) * sampleRate);

  const boundaryFromClientX = (clientX: number): SliceBoundary | null => {
    const canvas = canvasRef.current;
    if (!canvas || sourceLengthSamples <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const marker = boundaries
      .filter((boundary) => {
        if (boundary.id === sourceStartBoundaryId || boundary.id === sourceEndBoundaryId)
          return false;
        const seconds = boundary.sampleIndex / sampleRate;
        if (seconds < viewportStart || seconds > viewportEnd) return false;
        const markerX = ((seconds - viewportStart) / viewportDuration) * rect.width;
        return Math.abs(markerX - x) <= markerHitWidth / 2;
      })
      .sort(
        (left, right) =>
          Math.abs(left.sampleIndex - sampleFromClientX(clientX)) -
          Math.abs(right.sampleIndex - sampleFromClientX(clientX)),
      )[0];
    return marker ?? null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#f0e4c5';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (selectedSlice && sourceLengthSamples > 0) {
      const startSeconds = selectedSlice.startSample / sampleRate;
      const endSeconds = selectedSlice.endSample / sampleRate;
      const startX =
        ((Math.max(viewportStart, startSeconds) - viewportStart) / viewportDuration) * rect.width;
      const endX =
        ((Math.min(viewportEnd, endSeconds) - viewportStart) / viewportDuration) * rect.width;
      if (endX > startX) {
        ctx.fillStyle = 'rgba(217, 74, 50, 0.24)';
        ctx.fillRect(Math.round(startX), 0, Math.round(endX - startX), rect.height);
        ctx.strokeStyle = '#d94a32';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          Math.round(startX) + 1,
          1,
          Math.max(2, Math.round(endX - startX) - 2),
          rect.height - 2,
        );
      }
    }

    const channelCount = peaks?.channels.length ?? 0;
    const lanes = Math.max(1, channelCount);
    const laneHeight = rect.height / lanes;

    for (let lane = 0; lane < lanes; lane += 1) {
      const top = lane * laneHeight;
      const center = top + laneHeight / 2;
      ctx.strokeStyle = 'rgba(38, 30, 26, 0.42)';
      ctx.beginPath();
      ctx.moveTo(0, Math.round(center));
      ctx.lineTo(rect.width, Math.round(center));
      ctx.stroke();
    }

    if (!peaks) {
      ctx.fillStyle = '#56463b';
      ctx.fillText(t('waveform.empty'), 24, rect.height / 2);
      return;
    }

    const secondsPerPixel = viewportDuration / rect.width;

    peaks.channels.forEach((channel, lane) => {
      const level = channel.levels.reduce((best, current) => {
        const currentSecondsPerPeak = current.samplesPerPeak / peaks.sampleRate;
        const bestSecondsPerPeak = best.samplesPerPeak / peaks.sampleRate;
        return Math.abs(currentSecondsPerPeak - secondsPerPixel) <
          Math.abs(bestSecondsPerPeak - secondsPerPixel)
          ? current
          : best;
      }, channel.levels[0]);

      const top = lane * laneHeight;
      const center = top + laneHeight / 2;
      const amplitude = laneHeight * 0.42;
      const secondsPerPeak = level.samplesPerPeak / peaks.sampleRate;
      const startPeak = Math.max(0, Math.floor(viewportStart / secondsPerPeak));
      const endPeak = Math.min(level.maximums.length - 1, Math.ceil(viewportEnd / secondsPerPeak));

      ctx.strokeStyle = lane === 0 ? '#d94a32' : '#2755a5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let peakIndex = startPeak; peakIndex <= endPeak; peakIndex += 1) {
        const peakTime = peakIndex * secondsPerPeak;
        const x = Math.round((peakTime - viewportStart) / secondsPerPixel);
        const yMin = Math.round(center + level.minimums[peakIndex] * amplitude);
        const yMax = Math.round(center + level.maximums[peakIndex] * amplitude);
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
      }
      ctx.stroke();
    });

    ctx.fillStyle = '#261e1a';
    for (let tick = Math.ceil(viewportStart); tick <= viewportEnd; tick += 1) {
      const x = Math.round((tick - viewportStart) / secondsPerPixel);
      ctx.fillRect(x, 0, 2, 10);
      if (tick % 5 === 0) ctx.fillText(`${tick}s`, x + 4, 24);
    }

    boundaries.forEach((boundary, index) => {
      const seconds = boundary.sampleIndex / sampleRate;
      if (seconds < viewportStart || seconds > viewportEnd) return;
      const x = Math.round((seconds - viewportStart) / secondsPerPixel);
      const selected = boundary.id === selectedMarkerId;
      ctx.strokeStyle = boundary.fixed
        ? 'rgba(38, 30, 26, 0.36)'
        : selected
          ? '#d94a32'
          : '#2755a5';
      ctx.lineWidth = boundary.fixed ? 2 : selected ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
      if (!boundary.fixed) {
        ctx.fillStyle = selected ? '#d9aa21' : '#261e1a';
        ctx.fillRect(x - 6, 0, 12, selected ? 18 : 14);
        ctx.strokeStyle = '#261e1a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 6, 0, 12, selected ? 18 : 14);
        if (boundaries.length <= 66) {
          ctx.fillStyle = selected ? '#261e1a' : '#f6edcf';
          ctx.fillText(String(index), x + 8, 15);
        }
      }
    });

    previewCandidates.forEach((candidate) => {
      const seconds = candidate.sampleIndex / sampleRate;
      if (seconds < viewportStart || seconds > viewportEnd) return;
      const x = Math.round((seconds - viewportStart) / secondsPerPixel);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(89, 55, 113, 0.76)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(246, 237, 207, 0.9)';
      ctx.strokeStyle = '#593771';
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x + 6, 8);
      ctx.lineTo(x, 14);
      ctx.lineTo(x - 6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    const playheadX = Math.round((playback.positionSeconds - viewportStart) / secondsPerPixel);
    if (playheadX >= 0 && playheadX <= rect.width) {
      ctx.fillStyle = '#27867b';
      ctx.fillRect(playheadX - 2, 0, 4, rect.height);
    }
  }, [
    boundaries,
    peaks,
    playback.positionSeconds,
    previewCandidates,
    sampleRate,
    selectedMarkerId,
    selectedSlice,
    sourceLengthSamples,
    t,
    viewportDuration,
    viewportEnd,
    viewportStart,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={
        tool === 'add-marker' ? 'waveform-canvas waveform-canvas--add-marker' : 'waveform-canvas'
      }
      aria-label={t('waveform.label')}
      role="img"
      tabIndex={0}
      onClick={(event) => {
        if (!peaks || dragRef.current) return;
        const sample = sampleFromClientX(event.clientX);
        if (tool === 'add-marker' || event.altKey) {
          onAddMarker(sample);
          return;
        }
        const marker = boundaryFromClientX(event.clientX);
        if (marker) {
          onSelectMarker(marker.id);
          return;
        }
        onSelectMarker(null);
        onSelectSliceAtSample(sample);
        onSeek(secondsFromClientX(event.clientX));
      }}
      onPointerDown={(event) => {
        if (!peaks) return;
        const marker = boundaryFromClientX(event.clientX);
        if (marker) {
          dragRef.current = { type: 'marker', id: marker.id, committed: false };
          onSelectMarker(marker.id);
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
        if (tool === 'select' && !event.altKey) {
          dragRef.current = { type: 'pan', x: event.clientX, start: viewportStart };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        if (!peaks || !dragRef.current) return;
        if (dragRef.current.type === 'marker') {
          dragRef.current.committed = true;
          onMoveMarkerPreview(dragRef.current.id, sampleFromClientX(event.clientX));
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const deltaPixels = event.clientX - dragRef.current.x;
        onPan(
          dragRef.current.start + (-deltaPixels / rect.width) * viewportDuration - viewportStart,
        );
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.type === 'marker') {
          onMoveMarkerCommit(dragRef.current.id, sampleFromClientX(event.clientX));
        }
        window.setTimeout(() => {
          dragRef.current = null;
        }, 0);
      }}
      onWheel={(event) => {
        if (!peaks) return;
        event.preventDefault();
        onWheelZoom(event.deltaY < 0 ? 1.2 : 0.84, secondsFromClientX(event.clientX));
      }}
    />
  );
}
