# Offline Requirements

The built Drumulizer application must run without internet access and must not include networking features. v0.4.0 imports audio only from user-selected local WAV or MP3 files and runs waveform, slice, and onset analysis locally.

## Production

Production blocks outgoing HTTP and HTTPS requests from the Electron session. The app does not use remote APIs, cloud AI, machine learning services, telemetry, analytics, crash-reporting services, CDNs, online font loading, remote images, remote stylesheets, automatic updates, remote configuration, feature flags, online authentication, or remote license checks. There is no remote URL import field, browser component, network client, or remote media loader.

Onset detection is deterministic DSP running in a local renderer worker. It does not send audio, filenames, metadata, candidate information, or analysis metrics to any remote service.

The UI does not need persistent offline-mode badges to satisfy this rule. Offline behavior is enforced by architecture and security policy, while user-facing status is limited to the current app state.

## Development

Development allows only the local Vite server on loopback hosts such as `localhost` and `127.0.0.1`. Arbitrary development network access is not allowed.

## Adding Local Resources

Add assets inside the repository and load them with relative paths. Third-party assets require copied licenses and `THIRD_PARTY_LICENSES.md` entries.

## Why Remote Assets Are Forbidden

Audio tools must stay available, private, deterministic, and usable when disconnected. Remote assets create privacy, reliability, licensing, and reproducibility risks.

## Verification Checklist

- Launch packaged app with network disconnected.
- Confirm the renderer starts.
- Inspect network requests.
- Confirm HTTP and HTTPS requests are blocked.
- Confirm fonts, CSS, images, and scripts load locally.
- Confirm no telemetry or updater package is present.
- Confirm the primary UI has no URL import affordance, offline/network mode control, or remote media loader.
