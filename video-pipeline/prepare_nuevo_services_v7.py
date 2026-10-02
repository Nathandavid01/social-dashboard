"""Render the immutable v7 numeric service-progress overlay."""
from functools import lru_cache
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pipeline import FFMPEG

R = Path(__file__).resolve().parent
W, H, FPS, FRAMES = 1080, 1920, 30, 162
OUTPUT = R / "media/arecibo/nuevo-lab-services-v7.mov"
FONT = R / "media/arecibo/brand/Montserrat-Bold.ttf"
GREEN = (156, 230, 8)
EVENTS = ((0.80, "01"), (2.74, "02"), (3.98, "03"))


def ease(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


@lru_cache(None)
def font(size):
    return ImageFont.truetype(str(FONT), size)


def frame_at(t):
    fade = 1.0 - ease((t - 4.94) / 0.42)
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, :3] = (4, 20, 29)
    yy = np.arange(H)
    strength = np.clip((yy - 900) / 310, 0, 1) * np.clip((1780 - yy) / 260, 0, 1)
    rgba[:, :, 3] = (strength[:, None] * 128 * fade).astype(np.uint8)
    image = Image.fromarray(rgba)
    draw = ImageDraw.Draw(image)

    revealed = [event for event in EVENTS if t >= event[0]]
    if not revealed:
        return image

    gap = 94
    total = len(EVENTS) * 48 + (len(EVENTS) - 1) * (gap - 48)
    start_x = (W - total) // 2
    active_index = len(revealed) - 1
    for index, (at, number) in enumerate(EVENTS):
        reveal = ease((t - at) / 0.18)
        if reveal <= 0:
            continue
        x = start_x + index * gap
        active = index == active_index
        color = (*GREEN, round(255 * reveal * fade)) if active else (220, 232, 236, round(190 * fade))
        draw.text((x, 1285 + round(8 * (1 - reveal))), number, font=font(29), fill=color)
        if index < 2 and t >= EVENTS[index + 1][0]:
            draw.line((x + 51, 1303, x + 82, 1303), fill=(210, 226, 231, round(110 * fade)), width=2)
    return image


def main():
    if OUTPUT.exists():
        raise FileExistsError(f"Immutable output already exists: {OUTPUT}")
    proc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-n", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "qtrle", str(OUTPUT)],
        stdin=subprocess.PIPE,
    )
    try:
        for index in range(FRAMES):
            proc.stdin.write(frame_at(index / FPS).tobytes())
    finally:
        proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("v7 services overlay encoding failed")
    print(OUTPUT)


if __name__ == "__main__":
    main()
