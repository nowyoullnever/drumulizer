# Export Evaluation

Focused export tests cover WAV headers, deterministic bytes, Pattern render planning, transformed Events, Granular and Ratchet expansion, stem file generation, Slice export, clipping diagnostics, and duration diagnostics.

Release guardrails:

```text
render-plan reproducibility: 100%
duplicate voice keys: 0
invalid source offsets: 0 in focused fixtures
invalid audio times: 0
portable source hash match: exact
WAV duration error: at most one output sample in focused fixtures
```

These checks validate deterministic local export behavior. They do not measure musical quality.
