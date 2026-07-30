# Onset Evaluation

Drumulizer v0.4.0 uses a deterministic generated corpus to guard offline onset-detection behavior. These fixtures are regression tests, not proof of universal real-audio accuracy.

## Corpus

The corpus contains 19 fixtures:

- isolated impulse
- repeated impulse train
- kick-like decaying sine bursts
- snare-like filtered noise bursts
- high-frequency clicks
- alternating low and high attacks
- quiet transients over low noise
- gain pattern 0.25
- gain pattern 0.7
- gain pattern 1.4
- sustained sine
- gradual ramp
- repeated slow swells
- sharp attack over gradual ramp
- dense polyphonic synthetic material
- close attacks
- silence
- DC offset input
- non-finite input

Expected events are represented as seconds from source start. Matching uses one-to-one candidate-to-expected matching within a 25ms tolerance. Metrics include precision, recall, F1, mean absolute timing error, maximum timing error, and candidates per second.

## Release Guardrails

- recall must stay at or above 0.95
- F1 must stay at or above 0.88
- mean timing error must remain below 15ms
- maximum timing error must remain within the 25ms matching tolerance
- silence must produce zero candidates
- gradual ramp and sustained sine must remain conservative
- candidates must stay in range
- duplicate candidate sample positions are not allowed

## Phase 2 Baseline

```text
19 fixtures
TP 39
FP 8
FN 0
Precision 0.830
Recall 1.000
F1 0.907
Mean timing error 2.15ms
Maximum timing error 16.58ms
```

## Phase 3 Result

The Phase 3 detector algorithm was not retuned. The only audio-boundary code change clamps candidate audition near the source end.

```text
19 fixtures
TP 39
FP 8
FN 0
Precision 0.830
Recall 1.000
F1 0.907
Mean timing error 2.15ms
Maximum timing error 16.58ms
```

Phase 3 result difference from baseline: no detector-quality change.

## False-Positive Fixtures

The known false-positive pressure points are dense polyphonic synthetic material, alternating low/high material with residual ringing, and quiet transients over low noise. Current suppression keeps these within release guardrails while preserving recall.

## Real-Audio Validation

No private or copyrighted files are committed. During Phase 3, validation used generated local fixtures and synthetic local WAV files. Real vocal phrase, field-recording, and full mixed-track validation remains a known validation gap unless suitable user-owned local files are provided.
