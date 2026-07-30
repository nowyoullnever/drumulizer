import {
  MAX_ACTIVE_SEQUENCER_VOICES,
  SEQUENCER_LOOKAHEAD_MS,
  SEQUENCER_SCHEDULE_AHEAD_SECONDS,
} from '../../shared/constants/sequencer';
import { getAudioContext } from '../audio/importAudio';
import type { SliceRegion } from '../slice/types';
import { buildEventAudioPlan } from './eventAudio';
import {
  beatsFromPosition,
  patternDurationSeconds,
  scheduleWindow,
  stepFromPosition,
} from './schedulerMath';
import type { SequencerEvent, SequencerPattern, SequencerTransportState } from './types';

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode | null;
}

export class SequencerEngine {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private buffer: AudioBuffer | null = null;
  private pattern: SequencerPattern | null = null;
  private slices: SliceRegion[] = [];
  private status: SequencerTransportState['status'] = 'stopped';
  private startContextTime = 0;
  private pausedPositionSeconds = 0;
  private scheduledKeys = new Set<string>();
  private voices = new Set<ActiveVoice>();
  private masterGain = 0.85;

  load(buffer: AudioBuffer): SequencerTransportState {
    this.stop();
    this.buffer = buffer;
    return this.snapshot();
  }

  clear(): SequencerTransportState {
    this.stop();
    this.buffer = null;
    return this.snapshot();
  }

  setMasterGain(gain: number): void {
    this.masterGain = Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 0.85));
  }

  async play(pattern: SequencerPattern, slices: SliceRegion[]): Promise<SequencerTransportState> {
    if (!this.buffer) return this.snapshot();
    this.context = getAudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    this.update(pattern, slices);
    if (this.status !== 'paused') this.pausedPositionSeconds = 0;
    this.startContextTime = this.context.currentTime - this.pausedPositionSeconds;
    this.status = 'playing';
    this.scheduledKeys.clear();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), SEQUENCER_LOOKAHEAD_MS);
    return this.snapshot();
  }

  update(pattern: SequencerPattern, slices: SliceRegion[]): SequencerTransportState {
    this.pattern = pattern;
    this.slices = slices;
    return this.snapshot();
  }

  pause(): SequencerTransportState {
    if (this.status !== 'playing' || !this.context) return this.snapshot();
    this.pausedPositionSeconds = this.positionSeconds();
    this.stopTimer();
    this.stopVoices();
    this.status = 'paused';
    return this.snapshot();
  }

  stop(): SequencerTransportState {
    this.stopTimer();
    this.stopVoices();
    this.status = 'stopped';
    this.pausedPositionSeconds = 0;
    this.scheduledKeys.clear();
    return this.snapshot();
  }

  snapshot(): SequencerTransportState {
    const pattern = this.pattern;
    const position =
      this.status === 'playing' ? this.positionSeconds() : this.pausedPositionSeconds;
    return {
      status: this.status,
      currentStep: pattern ? stepFromPosition(pattern, position) : 0,
      positionBeats: pattern ? beatsFromPosition(pattern.bpm, position) : 0,
    };
  }

  async auditionEvent(input: {
    event: SequencerEvent;
    pattern: SequencerPattern;
    slices: SliceRegion[];
    buffer: AudioBuffer;
    masterGain: number;
  }): Promise<void> {
    this.stop();
    this.context = getAudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    const slice = input.slices.find((candidate) => candidate.id === input.event.sliceId);
    if (!slice) return;
    this.scheduleAudio(
      input.event,
      input.pattern,
      slice,
      this.context.currentTime + 0.01,
      input.masterGain,
    );
  }

  private tick(): void {
    if (!this.context || !this.pattern || this.status !== 'playing') return;
    const position = this.positionSeconds();
    const patternDuration = patternDurationSeconds(this.pattern);
    if (!this.pattern.loopEnabled && position >= patternDuration) {
      this.stop();
      return;
    }
    const result = scheduleWindow({
      pattern: this.pattern,
      slices: this.slices,
      windowStartSeconds: position,
      windowEndSeconds: position + SEQUENCER_SCHEDULE_AHEAD_SECONDS,
      transportOriginSeconds: this.startContextTime,
      scheduledKeys: this.scheduledKeys,
      masterGain: this.masterGain,
    });
    for (const scheduled of result.scheduled) {
      if (this.voices.size >= MAX_ACTIVE_SEQUENCER_VOICES) break;
      const event = this.pattern.events.find((candidate) => candidate.id === scheduled.eventId);
      const slice = this.slices.find((candidate) => candidate.id === event?.sliceId);
      if (event && slice)
        this.scheduleAudio(event, this.pattern, slice, scheduled.audioTimeSeconds, this.masterGain);
    }
  }

  private scheduleAudio(
    event: SequencerEvent,
    pattern: SequencerPattern,
    slice: SliceRegion,
    audioTimeSeconds: number,
    masterGain: number,
  ): void {
    if (!this.context || !this.buffer) return;
    const plan = buildEventAudioPlan({
      event,
      slice,
      lane: pattern.lanes[event.laneId],
      masterGain,
    });
    if (plan.durationSeconds <= 0) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const panner =
      typeof this.context.createStereoPanner === 'function'
        ? this.context.createStereoPanner()
        : null;
    source.buffer = this.buffer;
    source.playbackRate.value = plan.playbackRate;
    if (panner) {
      panner.pan.value = plan.pan;
      source.connect(gain);
      gain.connect(panner);
      panner.connect(this.context.destination);
    } else {
      source.connect(gain);
      gain.connect(this.context.destination);
    }
    const fade = plan.fadeSeconds;
    const start = Math.max(this.context.currentTime, audioTimeSeconds);
    const stop = start + plan.durationSeconds;
    const fadeOutStart = Math.max(start + fade, stop - fade);
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(plan.outputGain, start + fade);
    gain.gain.setValueAtTime(plan.outputGain, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, stop);
    const voice: ActiveVoice = { source, gain, panner };
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.voices.delete(voice);
    };
    source.start(start, plan.offsetSeconds, plan.sourceDurationSeconds);
    source.stop(stop);
    this.voices.add(voice);
  }

  private positionSeconds(): number {
    if (!this.context || !this.pattern) return this.pausedPositionSeconds;
    const elapsed = Math.max(0, this.context.currentTime - this.startContextTime);
    const duration = patternDurationSeconds(this.pattern);
    if (this.pattern.loopEnabled) return duration > 0 ? elapsed % duration : 0;
    return Math.min(duration, elapsed);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private stopVoices(): void {
    for (const voice of this.voices) {
      voice.source.onended = null;
      try {
        voice.source.stop();
      } catch {
        // Already stopped voices are safe to ignore.
      }
      voice.source.disconnect();
      voice.gain.disconnect();
      voice.panner?.disconnect();
    }
    this.voices.clear();
  }
}
