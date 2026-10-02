"""Render the immutable v6 services callout used by Nuevo Laboratorio."""
from functools import lru_cache
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pipeline import FFMPEG

R = Path(__file__).resolve().parent
W, H, FPS, FRAMES = 1080, 1920, 30, 162
OUTPUT = R / "media/arecibo/nuevo-lab-services-v6.mov"
FONT = R / "media/arecibo/brand/Montserrat-Bold.ttf"
GREEN = (156, 230, 8)
EVENTS = (
    (0.80, "01", ("PRUEBAS DE", "PATERNIDAD")),
    (2.74, "02", ("PRUEBAS DE DOPAJE",)),
    (3.98, "03", ("CULTIVOS",)),
)
PREVIEWS = {
    30: R / "runs/nuevo-services-v6-01.png",
    88: R / "runs/nuevo-services-v6-02.png",
    125: R / "runs/nuevo-services-v6-03.png",
    155: R / "runs/nuevo-services-v6-fade.png",
}


def ease(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


@lru_cache(None)
def font(size):
    return ImageFont.truetype(str(FONT), size)


def centered_text(draw, y, text, opacity):
    """Draw one caption-style green highlight, tightly fitted to its text."""
    face = font(70)
    box = draw.textbbox((0, 0), text, font=face)
    tw = box[2] - box[0]
    th = box[3] - box[1]
    x = (W - tw) // 2
    pad_x, pad_y = 24, 12
    draw.rectangle(
        (x - pad_x, y - pad_y, x + tw + pad_x, y + th + pad_y),
        fill=(*GREEN, round(255 * opacity)),
    )
    draw.text((x, y - box[1]), text, font=face, fill=(255, 255, 255, round(255 * opacity)))


def frame_at(t):
    fade = 1.0 - ease((t - 4.94) / 0.42)
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, :3] = (4, 20, 29)
    yy = np.arange(H)
    # Broad, feathered lower-third scrim; the clinician's face remains untouched.
    strength = np.clip((yy - 900) / 310, 0, 1) * np.clip((1780 - yy) / 260, 0, 1)
    rgba[:, :, 3] = (strength[:, None] * 128 * fade).astype(np.uint8)
    image = Image.fromarray(rgba)
    draw = ImageDraw.Draw(image)

    revealed = [event for event in EVENTS if t >= event[0]]
    if not revealed:
        return image

    # The small numeric track accumulates, while the service phrase remains singular.
    gap = 94
    total = len(EVENTS) * 48 + (len(EVENTS) - 1) * (gap - 48)
    start_x = (W - total) // 2
    for index, (at, number, _) in enumerate(EVENTS):
        reveal = ease((t - at) / 0.18)
        if reveal <= 0:
            continue
        x = start_x + index * gap
        active = index == len(revealed) - 1
        color = (*GREEN, round(255 * reveal * fade)) if active else (220, 232, 236, round(190 * fade))
        draw.text((x, 1095 + round(8 * (1 - reveal))), number, font=font(29), fill=color)
        if index < 2 and t >= EVENTS[index + 1][0]:
            draw.line((x + 51, 1113, x + 82, 1113), fill=(210, 226, 231, round(110 * fade)), width=2)

    active_index = len(revealed) - 1
    at, _, lines = EVENTS[active_index]
    phrase_alpha = ease((t - at) / 0.18) * fade
    top = 1205 if len(lines) == 1 else 1158
    for line_index, line in enumerate(lines):
        centered_text(draw, top + line_index * 94, line, phrase_alpha)
    return image


def main():
    if OUTPUT.exists():
        raise FileExistsError(f"Immutable output already exists: {OUTPUT}")
    collisions = [path for path in PREVIEWS.values() if path.exists()]
    if collisions:
        raise FileExistsError(f"Preview already exists: {collisions[0]}")
    proc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-n", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "qtrle", str(OUTPUT)],
        stdin=subprocess.PIPE,
    )
    try:
        for index in range(FRAMES):
            frame = frame_at(index / FPS)
            if index in PREVIEWS:
                frame.save(PREVIEWS[index])
            proc.stdin.write(frame.tobytes())
    finally:
        proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("v6 services overlay encoding failed")
    print(OUTPUT)
    for path in PREVIEWS.values():
        print(path)


if __name__ == "__main__":
    main()
