# Source Relinking

Linked projects resolve source audio by trying the stored relative path first, then the stored absolute path. Candidate files must match byte length and SHA-256.

If the source is missing or mismatched, relinking requires the user to choose a WAV or MP3 with the same extension and exact SHA-256. A file with only the same filename is rejected.

This hash is an identity check, not authentication. It prevents accidental loading of the wrong sample. Portable `.drumz` projects avoid relinking by embedding the original encoded source bytes.
