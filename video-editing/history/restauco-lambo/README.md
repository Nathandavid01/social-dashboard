# Restauco — reference edit

Restauco-Lambo-VW-v1.mp4: 32.867 seconds, 1080 × 1920, 30 fps.

Uses the supplied dummy MP4 as the visual reference and the supplied DJI clip as footage. Countdown 0–2.08s and walking pause 13.10–16.50s removed; ends at source 38.32s. Original sequence and dialogue retained. White sentence-case Arial captions with dark outline/shadow, placed like the reference. No added music or effects.

Rendered through a task-local copy of the existing Nate Video Pipeline. Removed inherited teal/gold decorations to match this reference. Original files unchanged. Recipe: pipeline/edits/v1.json.

Full decode and duration verification passed. Full-timeline contact sheet and caption detail inspected. Audio measured -18.96 LUFS, -2.13 dBTP. Critical listening not performed. Captions are ASR-assisted; the unclear final sentence after “pero” is audible but uncaptioned pending the user's wording confirmation.

## V2 — supplied caption screenshot

Caption treatment updated to white Arial with an opaque gray outline and black offset shadow, matching the supplied crop. Layout, text and timeline retained. Recipe: pipeline/edits/v2.json. Final spoken sentence still awaits caption wording confirmation.

## V3 — ending subtitles and original outro

Added captions through the end of the dialogue and appended the original Restauco animated logo / website outro from the supplied example (50.60–53.80s), with its closing audio at 70% gain. Final output expected duration: 36.04s. Caption style retained from v2. Ending transcribed with Whisper large-v3-turbo; “número” is the best editorial reading of unclear audio and remains subject to user correction.

V3 render recovery: macOS offloaded pipeline dependencies during export. render-resume.py loads the existing cached effects module and runs the same pipeline renderer with a compact local review-report writer. Full decode remains enforced by the pipeline.

## V4 — supplied music

User-supplied WhatsApp video audio mixed beneath dialogue with automatic ducking, a crossfade loop, and a fade out through the Restauco outro. Replaces the original outro soundtrack. Video stream copied without re-encoding. Full decode passed. Reproduce with add_music_v4.py.

## V5 — screenshot-matched caption rendering

Caption glyphs rebuilt using Tahoma Regular, selected by comparing rendered letter masks to the screenshot. Added the screenshot's white-to-silver vertical fill, a thinner antialiased gray outline, and a soft black drop shadow. Raster captions rendered at 3× resolution then downsampled. Clean source footage used to avoid layering over old captions; v4 mixed audio copied without re-encoding. Restauco outro and ending caption content retained. Reproduce with render_v5.py. Exact original font metadata was not available; this is a visual match.
