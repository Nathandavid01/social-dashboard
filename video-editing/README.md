# Video editing archive and client rules

This folder preserves the local video-editing work from September 26, 2026. It is separate from the dashboard application's production video workflow.

- [Shared editing checks](WORKFLOW.md)
- [Client index](clients/README.md)
- [Restauco rules](clients/restauco/RULES.md)
- [Restauco machine-readable style](clients/restauco/style.json)
- [Restauco session and revision index](projects/restauco/2026-09-26/README.md)
- `history/`: scripts, recipes, transcripts, QA reports, and editorial notes from the session. Earlier revisions are retained as history, not current instructions.

## Media archive

The accompanying GitHub prerelease `restauco-editing-2026-09-26` holds the source videos, supplied music/reference/outros, all rendered revisions, and the complete session snapshot. Large media is kept out of Git history. `archive-manifest.json` records the paths, sizes, and SHA-256 checksums.

Final deliverables in the archive:

- `history/restauco-lambo/Restauco-Lambo-VW-v5.mp4`
- `history/restauco-fall-winter/Restauco-Fall-Winter-v3.mp4`

The English v3 supersedes v1/v2: it removes the pre-roll, rebuilds caption timing, retains the English outro, and compensates measured audio-processing latency. The Spanish edit's final word “número” remains an interpretation of unclear speech and should be confirmed before publishing.

## Reuse

Use the client rules and project recipe as the starting point, not an earlier draft. Archived scripts document the exact rendering steps; they are historical task scripts rather than a packaged Python API. Their local paths are normalized to `$WORKSPACE`, `$HOME`, and `$TMPDIR` in the repository copy. Set the corresponding paths to the extracted archive and your local assets before running them. Consult the revision index for the final script sequence.

Dependencies: Python 3.10+, Pillow, NumPy for timing analysis, FFmpeg/ffprobe, and whisper.cpp for transcription/alignment. Font binaries and speech-model weights are not redistributed; supply a licensed local Tahoma font and an appropriate Whisper model. For the original macOS renderer, the Tahoma lookup is `/System/Library/Fonts/Supplemental/Tahoma.ttf`.

Public publication/social posting is separate from an editing export. A technically passing render still requires editorial review.
