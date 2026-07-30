# Drumulizer Agent Notes

- User-facing progress, warnings, issue updates, reports, and completion notes must be Korean.
- Source code, identifiers, filenames, commit messages, and technical terms may use English.
- Korean and English UI must remain supported, and all user-visible strings must use the internal i18n system.
- Drumulizer is a local/offline application: no networking features, APIs, telemetry, CDN assets, remote assets, or automatic updates.
- Preserve the established 1970s pixel/modular visual system.
- Do not reintroduce offline badges, fake cache metrics, CPU meters, voice counters, or other fake resource metrics.
- Windows packaging must use `--publish never`.
- Do not claim tests passed unless they were executed.
- Use fast feature verification during implementation; reserve full verification for stable checkpoints.
- Perform Windows packaging only during version-finalization tasks.
- Preserve existing functionality unless the task explicitly changes it.
