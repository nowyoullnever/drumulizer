# Local File Import

Drumulizer imports local audio files only. There is no URL import, remote media import, cloud storage, authentication, telemetry, or remote logging.

## Native Dialog Path

The renderer calls `window.drumulizer.selectLocalAudioFile()`. The main process opens Electron's native file dialog with WAV/MP3 filters, validates the selected item again, confirms it is a regular file, rejects directories and unsupported extensions, checks size, reads bytes, and returns only limited metadata plus bytes.

The renderer never receives a full local filesystem path and never receives unrestricted filesystem functions.

## Drag-And-Drop Path

The renderer accepts exactly one dropped local browser `File`, rejects multiple files and unsupported extensions, prevents default browser navigation, reads bytes through the File API, and sends the result into the same decode pipeline as native dialog imports.

Dropped text is not interpreted as a URL.

## Limits

- Maximum file size: 250 MB
- Maximum decoded duration: 30 minutes

The constants live in `src/shared/constants/audio.ts`.

## Privacy

Drumulizer displays the base file name, format, size, duration, sample rate, and channel count. It does not display full private directory paths.

## Failure Handling

Unsupported extensions, empty files, directories, corrupted audio, decode failures, excessive size, excessive duration, invalid channels, and invalid duration are returned or thrown as stable error codes. The renderer maps those codes through the current locale dictionary, so the same failure can be shown in Korean or English. Canceling the dialog is not an error.
