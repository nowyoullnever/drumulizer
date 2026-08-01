import {
  MAX_ACTIVE_SEQUENCER_VOICES,
  SEQUENCER_LOOKAHEAD_MS,
} from '../../shared/constants/sequencer';
import { getAudioContext } from '../audio/importAudio';
import type { SliceRegion } from '../slice/types';
import {
  beatsFromPosition,
  dynamicScheduleAheadSeconds,
  dynamicTransportStartLeadSeconds,
  patternDurationSeconds,
  scheduleWindow,
  stepFromPosition,
} from './schedulerMath';
import { ReverseBufferCache, reverseOffsetForSliceBuffer } from './reverseBufferCache';
import type {
  ScheduledSequencerEvent,
  SequencerEvent,
  SequencerPattern,
  SequencerTransportState,
} from './types';

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
  private seed = 'drumulizer-090';
  private sourceId = 'source';
  private reverseCache = new ReverseBufferCache();

  load(buffer: AudioBuffer): SequencerTransportState {
    this.stop();
    this.buffer = buffer;
    this.sourceId = `source-${buffer.sampleRate}-${buffer.length}-${buffer.numberOfChannels}`;
    this.reverseCache.clear();
    return this.snapshot();
  }

  clear(): SequencerTransportState {
    this.stop();
    this.buffer = null;
    this.reverseCache.clear();
    return this.snapshot();
  }

  setMasterGain(gain: number): void {
    this.masterGain = Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 0.85));
  }

  async play(input: {
    pattern: SequencerPattern;
    slices: SliceRegion[];
    seed?: string;
  }): Promise<SequencerTransportState> {
    if (!this.buffer) return this.snapshot();
    this.context = getAudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    this.seed = input.seed ?? this.seed;
    this.update(input.pattern, input.slices);
    await this.prewarmReverseBuffers(input.pattern, input.slices);
    if (this.status !== 'paused') this.pausedPositionSeconds = 0;
    const lead = this.status === 'paused' ? 0 : dynamicTransportStartLeadSeconds(input.pattern);
    this.startContextTime = this.context.currentTime + lead - this.pausedPositionSeconds;
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
    const auditionEvent: SequencerEvent = {
      ...input.event,
      transform: { ...input.event.transform, probability: 1 },
    };
    await this.prewarmReverseBuffers({ ...input.pattern, events: [auditionEvent] }, input.slices);
    const result = scheduleWindow({
      pattern: { ...input.pattern, events: [auditionEvent], loopEnabled: false },
      slices: input.slices,
      windowStartSeconds: 0,
      windowEndSeconds: dynamicScheduleAheadSeconds(input.pattern),
      transportOriginSeconds: this.context.currentTime + 0.01,
      scheduledKeys: new Set<string>(),
      masterGain: input.masterGain,
      seed: this.seed,
      maxVoices: MAX_ACTIVE_SEQUENCER_VOICES,
    });
    for (const scheduled of result.scheduled)
      void this.scheduleVoice(scheduled, auditionEvent, slice);
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
      windowStartSeconds: Math.max(
        -dynamicTransportStartLeadSeconds(this.pattern),
        position - dynamicScheduleAheadSeconds(this.pattern),
      ),
      windowEndSeconds: position + dynamicScheduleAheadSeconds(this.pattern),
      transportOriginSeconds: this.startContextTime,
      scheduledKeys: this.scheduledKeys,
      masterGain: this.masterGain,
      seed: this.seed,
    });
    for (const scheduled of result.scheduled) {
      if (this.voices.size >= MAX_ACTIVE_SEQUENCER_VOICES) break;
      const event = this.pattern.events.find((candidate) => candidate.id === scheduled.eventId);
      const slice = this.slices.find((candidate) => candidate.id === event?.sliceId);
      if (event && slice) void this.scheduleVoice(scheduled, event, slice);
    }
  }

  private async scheduleVoice(
    scheduled: ScheduledSequencerEvent,
    event: SequencerEvent,
    slice: SliceRegion,
  ): Promise<void> {
    if (!this.context || !this.buffer) return;
    if (scheduled.durationSeconds <= 0) return;
    let sourceBuffer = this.buffer;
    if (scheduled.reverse) {
      try {
        sourceBuffer = await this.reverseCache.getOrCreate({
          context: this.context,
          sourceId: this.sourceId,
          source: this.buffer,
          slice,
        });
      } catch {
        return;
      }
    }
    const offsetSeconds = scheduled.reverse
      ? reverseOffsetForSliceBuffer({
          slice,
          sourceOffsetSeconds: scheduled.offsetSeconds,
          durationSeconds: scheduled.durationSeconds,
        })
      : scheduled.offsetSeconds;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const panner =
      typeof this.context.createStereoPanner === 'function'
        ? this.context.createStereoPanner()
        : null;
    source.buffer = sourceBuffer;
    source.playbackRate.value = scheduled.playbackRate;
    if (panner) {
      panner.pan.value = scheduled.pan;
      source.connect(gain);
      gain.connect(panner);
      panner.connect(this.context.destination);
    } else {
      source.connect(gain);
      gain.connect(this.context.destination);
    }
    const fade = scheduled.fadeSeconds;
    const start = Math.max(this.context.currentTime, scheduled.audioTimeSeconds);
    const stop = start + scheduled.durationSeconds;
    const fadeOutStart = Math.max(start + fade, stop - fade);
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0, start);
    const outputGain = scheduled.eventGain * scheduled.laneGain * this.masterGain;
    gain.gain.linearRampToValueAtTime(outputGain, start + fade);
    gain.gain.setValueAtTime(outputGain, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, stop);
    const voice: ActiveVoice = { source, gain, panner };
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.voices.delete(voice);
    };
    source.start(start, offsetSeconds, scheduled.sourceDurationSeconds);
    source.stop(stop);
    this.voices.add(voice);
  }

  private async prewarmReverseBuffers(
    pattern: SequencerPattern,
    slices: SliceRegion[],
  ): Promise<void> {
    if (!this.context || !this.buffer) return;
    const slicesById = new Map(slices.map((slice) => [slice.id, slice]));
    const reverseEvents = pattern.events.filter((event) => event.transform.reverse);
    await Promise.allSettled(
      reverseEvents.map((event) => {
        const slice = slicesById.get(event.sliceId);
        return slice
          ? this.reverseCache.getOrCreate({
              context: this.context as AudioContext,
              sourceId: this.sourceId,
              source: this.buffer as AudioBuffer,
              slice,
            })
          : Promise.resolve(this.buffer as AudioBuffer);
      }),
    );
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
