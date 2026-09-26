# Restauco session — September 26, 2026

## Current exports

| Project | Current version | Duration | Notes |
| --- | --- | --- | --- |
| Lambo / VW | v5 | 36.07 s | Spanish, screenshot-based caption treatment, supplied music, original Spanish outro. Final word “número” needs editorial confirmation. |
| Fall / winter | v3 | 17.53 s | English, production pre-roll removed, caption cues rebuilt from DTW timing, audio latency compensated, supplied English outro. |

## Revision history

Spanish: v1 established the edit; v2 revised the outline; v3 added the missing final captions and original outro; v4 added the supplied music; v5 rebuilt the glyphs, gradient and shadow to match the caption screenshot.

English: v1 applied the shared treatment but retained pre-roll and used incorrect ASR timing; v2 installed the supplied English outro; v3 removed source 0–2.30 s, retained the complete message through 14.30 s, replaced all caption timings, cleaned the voice gently and compensated 25 ms of audio-processing latency. Earlier English revisions are superseded and must not be delivered as current.

## Reproduction order

- Spanish v5: use its historical `render_v5.py` with the v3 edit recipe and the v4 audio mix from the media archive.
- English v3: run `v3/render.py`, then `v3/align_audio.py`. The second step removes the measured denoiser delay without re-encoding the picture.
- Obtain the caption helper and required local font before rendering; adapt normalized paths as explained in the archive README.

`projects.json` provides machine-readable source ranges, assets, final scripts, status, and known caveats. The full archive includes raw inputs, every rendered revision, screenshots, scripts, transcripts, and QA records.
