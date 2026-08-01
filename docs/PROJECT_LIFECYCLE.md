# Project Lifecycle

New Project clears source, markers, analysis, Pattern, project session, and dirty baseline after unsaved confirmation.

Open Project uses Main-process dialogs and transactional loading. The current project is replaced only after project data validates, source audio is loaded, decoded, and waveform peaks are built.

Save Project writes to the existing linked or portable session. Without a session, Renderer selects linked Save As for linked sources and portable Save As for temporary or portable-extracted sources.

Save Linked As writes `.drumproj` JSON and does not copy source audio. Save Portable writes `.drumz` with original encoded source bytes. Dirty baseline updates only after successful write.

Window closing uses a renderer `beforeunload` guard for unsaved creative changes. Undo/redo histories are intentionally reset after project load.
