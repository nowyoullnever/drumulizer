import { normalizePattern, sortEvents } from '../patternModel';
import type { SequencerEvent } from '../types';
import type { GenerationResult, MutatePatternInput } from './generatorTypes';
import { normalizeGeneratorSettings } from './generatorTypes';
import { generatePattern } from './generatePattern';

export const mutatePattern = (input: MutatePatternInput): GenerationResult => {
  const settings = normalizeGeneratorSettings(input.settings);
  const nextMutationIndex = input.mutationState.mutationIndex + 1;
  const generated = generatePattern({
    pattern: input.pattern,
    selectedEventId: input.selectedEventId,
    sliceInput: input.sliceInput,
    settings: {
      ...settings,
      seed: `${settings.seed}-mutation-${nextMutationIndex}`,
      density: Math.max(0, Math.min(100, settings.density + Math.round(settings.breakage / 8))),
      variation: Math.max(
        0,
        Math.min(100, settings.variation + Math.round(settings.breakage / 10)),
      ),
    },
    mutationState: input.mutationState,
    action: settings.mode === 'replace-unlocked' ? 'regenerate' : 'generate',
  });
  const mutatedIds = new Set(generated.pattern.events.map((event) => event.id));
  const events: SequencerEvent[] = generated.pattern.events.map((event) => {
    const previous = input.pattern.events.find((candidate) => candidate.id === event.id);
    if (previous && JSON.stringify(previous) === JSON.stringify(event)) return event;
    if (event.origin === 'generated' && mutatedIds.has(event.id))
      return { ...event, origin: 'mutated' };
    return event;
  });
  const pattern = normalizePattern({ ...generated.pattern, events: sortEvents(events) });
  return {
    ...generated,
    pattern,
    selectedEventId:
      pattern.events.find((event) => event.origin === 'mutated')?.id ?? generated.selectedEventId,
    summary: {
      ...generated.summary,
      action: 'mutate',
      seed: settings.seed,
      mutationIndex: nextMutationIndex,
      changed: Math.max(generated.summary.added, generated.summary.changed),
      messageKey: 'generator.summary.mutated',
    },
    mutationState: {
      baseSeed: settings.seed,
      mutationIndex: nextMutationIndex,
    },
  };
};
