import { useEffect, useRef } from 'react';
import type { PlaybackSnapshot, WaveformPeaks } from '../audio/types';
import { clamp } from '../audio/time';

interface WaveformCanvasProps {
  peaks: WaveformPeaks | null;
  playback: PlaybackSnapshot;
  viewportStart: number;
  viewportDuration: number;
  onSeek: (time: number) => void;
  onPan: (deltaSeconds: number) => void;
  onWheelZoom: (zoomFactor: number, anchorSeconds: number) => void;
}

export function WaveformCanvas({
  peaks,
  playback,
  viewportStart,
  viewportDuration,
  onSeek,
  onPan,
  onWheelZoom,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; start: number } | null>(null);

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
    ctx.strokeStyle = '#261e1a';
    ctx.lineWidth = 2;

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
      ctx.fillText('파형을 불러오면 여기에 표시됩니다.', 24, rect.height / 2);
      return;
    }

    const viewportEnd = viewportStart + viewportDuration;
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

    const playheadX = Math.round((playback.positionSeconds - viewportStart) / secondsPerPixel);
    if (playheadX >= 0 && playheadX <= rect.width) {
      ctx.fillStyle = '#27867b';
      ctx.fillRect(playheadX - 2, 0, 4, rect.height);
    }
  }, [peaks, playback.positionSeconds, viewportDuration, viewportStart]);

  const timeFromClientX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    return viewportStart + (x / rect.width) * viewportDuration;
  };

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      aria-label="오디오 파형"
      role="img"
      onClick={(event) => {
        if (!peaks || dragRef.current) return;
        onSeek(timeFromClientX(event.clientX));
      }}
      onPointerDown={(event) => {
        if (!peaks) return;
        dragRef.current = { x: event.clientX, start: viewportStart };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!peaks || !dragRef.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const deltaPixels = event.clientX - dragRef.current.x;
        onPan((-deltaPixels / rect.width) * viewportDuration);
      }}
      onPointerUp={() => {
        window.setTimeout(() => {
          dragRef.current = null;
        }, 0);
      }}
      onWheel={(event) => {
        if (!peaks) return;
        event.preventDefault();
        onWheelZoom(event.deltaY < 0 ? 1.2 : 0.84, timeFromClientX(event.clientX));
      }}
    />
  );
}
