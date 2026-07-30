import { getAudioContext } from './importAudio';
import { computeAuditionRegion } from './auditionMath';
import { calculatePauseOffset, calculatePlaybackPosition, clampSeek } from './playbackMath';
import type { PlaybackSnapshot, PlaybackStatus } from './types';

export class PlaybackEngine {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private auditionSource: AudioBufferSourceNode | null = null;
  private auditionGain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private status: PlaybackStatus = 'unavailable';
  private positionSeconds = 0;
  private startContextTime = 0;
  private startOffset = 0;
  private loopEnabled = false;
  private masterGain = 0.85;

  load(buffer: AudioBuffer): PlaybackSnapshot {
    this.stopSource();
    this.stopAudition();
    this.buffer = buffer;
    this.positionSeconds = 0;
    this.status = 'ready';
    return this.snapshot();
  }

  clear(): PlaybackSnapshot {
    this.stopSource();
    this.stopAudition();
    this.buffer = null;
    this.positionSeconds = 0;
    this.status = 'unavailable';
    return this.snapshot();
  }

  async play(): Promise<PlaybackSnapshot> {
    if (!this.buffer) return this.snapshot();
    if (this.status === 'playing') return this.snapshot();

    this.context = getAudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    this.ensureGain();
    this.stopSource();
    this.stopAudition();

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loopEnabled;
    source.connect(this.gain as GainNode);
    source.onended = (): void => {
      if (!source.loop && this.source === source) {
        this.positionSeconds = this.buffer?.duration ?? 0;
        this.status = 'ended';
        this.source = null;
      }
    };

    this.startOffset = clampSeek(this.positionSeconds, this.buffer.duration);
    this.startContextTime = this.context.currentTime;
    source.start(0, this.startOffset);
    this.source = source;
    this.status = 'playing';
    return this.snapshot();
  }

  pause(): PlaybackSnapshot {
    if (!this.context || !this.buffer || this.status !== 'playing') return this.snapshot();
    this.positionSeconds = calculatePauseOffset(
      this.context.currentTime,
      this.startContextTime,
      this.startOffset,
      this.buffer.duration,
    );
    this.stopSource();
    this.status = 'paused';
    return this.snapshot();
  }

  stop(): PlaybackSnapshot {
    this.stopSource();
    this.positionSeconds = 0;
    this.status = this.buffer ? 'ready' : 'unavailable';
    return this.snapshot();
  }

  seek(positionSeconds: number): PlaybackSnapshot {
    if (!this.buffer) return this.snapshot();
    const wasPlaying = this.status === 'playing';
    this.positionSeconds = clampSeek(positionSeconds, this.buffer.duration);
    if (wasPlaying) {
      void this.play();
    }
    return this.snapshot();
  }

  setLoop(enabled: boolean): PlaybackSnapshot {
    this.loopEnabled = enabled;
    if (this.source) this.source.loop = enabled;
    return this.snapshot();
  }

  setMasterGain(value: number): PlaybackSnapshot {
    this.masterGain = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (this.gain) this.gain.gain.value = this.masterGain;
    return this.snapshot();
  }

  async auditionSlice(input: {
    startSeconds: number;
    endSeconds: number;
    prerollMs: number;
  }): Promise<PlaybackSnapshot> {
    if (!this.buffer) return this.snapshot();
    this.context = getAudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    this.ensureGain();
    this.stopSource();
    this.stopAudition();
    this.status = 'ready';

    const region = computeAuditionRegion(input);
    if (region.durationSeconds <= 0) return this.snapshot();

    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const auditionGain = this.context.createGain();
    source.buffer = this.buffer;
    source.loop = false;
    source.connect(auditionGain);
    auditionGain.connect(this.gain as GainNode);

    const fade = region.fadeSeconds;
    auditionGain.gain.cancelScheduledValues(now);
    auditionGain.gain.setValueAtTime(0, now);
    auditionGain.gain.linearRampToValueAtTime(1, now + fade);
    const stopTime = now + region.durationSeconds;
    const fadeOutStart = Math.max(now + fade, stopTime - fade);
    auditionGain.gain.setValueAtTime(1, fadeOutStart);
    auditionGain.gain.linearRampToValueAtTime(0, stopTime);

    source.onended = (): void => {
      if (this.auditionSource === source) {
        this.auditionSource = null;
        this.auditionGain?.disconnect();
        this.auditionGain = null;
      }
    };
    source.start(0, region.offsetSeconds, region.durationSeconds);
    source.stop(stopTime);
    this.auditionSource = source;
    this.auditionGain = auditionGain;
    return this.snapshot();
  }

  stopSliceAudition(): PlaybackSnapshot {
    this.stopAudition();
    return this.snapshot();
  }

  snapshot(): PlaybackSnapshot {
    const duration = this.buffer?.duration ?? 0;
    const position =
      this.status === 'playing' && this.context && this.buffer
        ? calculatePlaybackPosition(
            this.context.currentTime,
            this.startContextTime,
            this.startOffset,
            duration,
            this.loopEnabled,
          )
        : this.positionSeconds;

    return {
      status: this.status,
      positionSeconds: Number.isFinite(position) ? position : 0,
      durationSeconds: duration,
      loopEnabled: this.loopEnabled,
      masterGain: this.masterGain,
    };
  }

  private ensureGain(): void {
    if (!this.context) return;
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    this.gain.gain.value = this.masterGain;
  }

  private stopSource(): void {
    if (!this.source) return;
    this.source.onended = null;
    try {
      this.source.stop();
    } catch {
      // Already stopped source nodes are safe to ignore.
    }
    this.source.disconnect();
    this.source = null;
  }

  private stopAudition(): void {
    if (!this.auditionSource) return;
    this.auditionSource.onended = null;
    try {
      this.auditionSource.stop();
    } catch {
      // Already stopped audition nodes are safe to ignore.
    }
    this.auditionSource.disconnect();
    this.auditionSource = null;
    this.auditionGain?.disconnect();
    this.auditionGain = null;
  }
}
