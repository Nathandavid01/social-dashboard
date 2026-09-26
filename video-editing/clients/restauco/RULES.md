# Restauco editing rules

These rules capture this session's user requests and corrections. They are client-specific. A particular word or draft should not be treated as approved merely because its styling was reused.

## Caption appearance

Reference: the supplied crop reading “Nos fuimos viral,” and the supplied edited Restauco example.

- Use sentence-case, centered white-to-silver text with a medium-gray edge and soft black drop shadow. Avoid the flat white/cartoon-outline treatment from early drafts.
- Latest visual implementation: Tahoma Regular, 72 px at 1080 × 1920, glyph-height scaling 93%, rendered at 3× resolution and downsampled with Lanczos.
- Fill stays white through about the upper 54% of each line, then transitions to approximately RGB(189,189,189) at the baseline.
- Gray outline: RGB(113,113,113), approximately 2.67 px with antialiasing. Shadow: black, 2.1 px blur, offset approximately 2.4 px right / 4.8 px down.
- Caption canvas: 1080 × 280 positioned at y=1255; block bottom at canvas y=250 (full-frame y=1505). Maximum line width 890 px; balanced two-line wrapping; line gap 17 px.
- No inherited teal/gold accents, colored karaoke highlighting, or scale-pop animation.
- Original font metadata was unavailable. Tahoma is the closest measured visual match selected in the final treatment, not a claim that the reference font was definitively identified.

## Caption content and timing

- Keep English videos captioned in English and Spanish videos in Spanish unless asked to translate.
- Correct the website to **Restauco.com** using the supplied branded outro, regardless of ASR spelling.
- Remove all pre-roll/countdown before placing the first caption. Verify actual speech onset; do not trust full-clip ASR offsets.
- Synchronize short phrases to measured speech and cover the complete ending. Recheck after any trim.
- In the fall/winter clip, use source 2.30–14.30 s, with the first caption at source 2.40 s. These timings are specific to that clip, not a universal intro trim.

## Music and sound

Use the user-supplied “WhatsApp Video 2026-08-04 at 21.13.24.mp4” audio as the background track.

- Base music gain 0.185 (approximately -14.66 dB).
- Duck under voice: sidechain threshold 0.035, ratio 3:1, attack 20 ms, release 350 ms.
- Gentle opening fade (0.35–0.45 s), approximately 1.77 s ending fade; rise to 1.778× the bed gain over 0.7 s after dialogue ends.
- For an edit longer than the 30.8-second music source, use a smooth crossfade loop (0.8 s in the Spanish revision).
- Keep the supplied music through the outro instead of layering embedded outro music on top.
- Preserve natural dialogue. High-pass around 65–75 Hz, gentle denoising only when useful, normalize speech around -16 LUFS with approximately -2 dBTP headroom. Measure and compensate processing latency.

## Outros

- **English:** use the complete supplied `RESTAUCOOUTROINGLES.mp4` animation, with “ORDER YOUR PART ONLINE AT” and USA delivery/shipping. The 30-fps timeline holds approximately 5.533 s.
- **Spanish:** use the original branded ending from the supplied edited example, source 50.60–53.80 s, with “ADQUIERE TU PIEZA ONLINE EN.”
- Match the video's language. Keep official artwork and URL intact; do not invent an outro when the reference already provides one.

## Export

Vertical 1080 × 1920, 30 fps, H.264, yuv420p, AAC 48 kHz / 256 kbps, fast-start MP4. Current high-quality export uses CRF 18; use clean source footage for caption revisions. Full decode, caption timing, opening, ending, and audio checks must pass before delivery.

## Current editorial caveat

In the Spanish Lambo/VW edit, “el número” in the final caption was inferred from unclear audio. Its wording still needs confirmation before publishing. Do not propagate that uncertainty to unrelated clips or omit their ending captions.
