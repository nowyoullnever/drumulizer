# Portable Project

Portable `.drumz` projects are single-file containers. They are not ZIP archives and never extract arbitrary filenames.

Binary layout:

```text
8 bytes   DRUMZ001
4 bytes   manifest byte length, unsigned little-endian
8 bytes   audio byte length, unsigned little-endian
N bytes   UTF-8 JSON manifest
M bytes   original encoded WAV or MP3 bytes
```

The manifest is a schema v1 project document whose source reference is `embedded`. Opening validates magic, header length, manifest size, audio size, JSON schema, and SHA-256. Embedded source bytes are copied to a unique temporary backing file owned by Drumulizer and cleaned best-effort on replacement or exit.

Portable projects are larger than linked projects but can be moved without the original source path. They still support only one source audio file in v0.9.0.
