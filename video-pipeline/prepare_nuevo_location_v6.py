"""Render the full-bleed v6 location motion clip for Nuevo Laboratorio."""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media/arecibo/DJI_20260909100140_0296_D.JPG"
OUTPUT = ROOT / "media/arecibo/nuevo-lab-location-v6.mp4"
CONTACT_SHEET = ROOT / "runs/arecibo-nuevo-lab-location-v6-contact-sheet.jpg"
FONT_PATH = ROOT / "media/arecibo/brand/Montserrat-Bold.ttf"
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"

WIDTH, HEIGHT = 1080, 1920
SCALE = 2
FPS = 30
DURATION = 3.2
FRAMES = math.ceil(DURATION * FPS)
NAVY = np.array((5, 22, 34), dtype=np.float32)
LIME = (156, 230, 8)


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def smooth(value: float) -> float:
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def typeface(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size * SCALE)


def photo_panel(photo: Image.Image, progress: float) -> Image.Image:
    """Crop tightly around the real upper façade; dated lower signage stays excluded."""
    # Source crop is restricted to y<1080. The dated banner starts below this region.
    left, top, right, bottom = 1510, 0, 3010, 1080
    base = photo.crop((left, top, right, bottom))
    zoom = 1.0 + 0.028 * smooth(progress)
    crop_w = round(base.width / zoom)
    crop_h = round(base.height / zoom)
    travel = round(22 * smooth(progress))
    x0 = min(base.width - crop_w, max(0, (base.width - crop_w) // 2 + travel))
    y0 = min(base.height - crop_h, max(0, (base.height - crop_h) // 2))
    base = base.crop((x0, y0, x0 + crop_w, y0 + crop_h))
    base = base.resize((WIDTH * SCALE, 1100 * SCALE), Image.Resampling.LANCZOS)
    base = ImageEnhance.Contrast(base).enhance(1.08)
    base = ImageEnhance.Color(base).enhance(0.92)
    data = np.asarray(base, dtype=np.float32)
    data[:, :, 0] *= 0.95
    data[:, :, 1] *= 1.01
    data[:, :, 2] *= 1.06
    return Image.fromarray(np.clip(data, 0, 255).astype(np.uint8))


def make_frame(photo: Image.Image, time_seconds: float) -> Image.Image:
    progress = time_seconds / DURATION
    photo_image = photo_panel(photo, progress)
    photo_data = np.asarray(photo_image, dtype=np.float32)
    h, w = HEIGHT * SCALE, WIDTH * SCALE
    frame = np.empty((h, w, 3), dtype=np.float32)
    frame[:] = NAVY

    # Full-bleed photograph from frame zero, with a seamless photographic-to-navy fade.
    frame[: 1100 * SCALE] = photo_data
    fade_start, fade_end = 760 * SCALE, 1160 * SCALE
    for y in range(fade_start, min(fade_end, h)):
        ratio = smooth((y - fade_start) / (fade_end - fade_start))
        if y < 1100 * SCALE:
            frame[y] = frame[y] * (1.0 - ratio) + NAVY * ratio
        else:
            frame[y] = NAVY

    canvas = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8)).convert("RGBA")
    text_layer = Image.new("RGBA", canvas.size)
    draw = ImageDraw.Draw(text_layer)

    # Title is already moving on frame zero; remaining information follows the speech.
    title_in = 0.22 + 0.78 * smooth((time_seconds + 0.10) / 0.46)
    road_label_in = smooth((time_seconds - 0.42) / 0.30)
    number_in = smooth((time_seconds - 0.78) / 0.32)
    hqj_in = smooth((time_seconds - 1.58) / 0.34)
    text_out = smooth((time_seconds - 2.90) / 0.24)
    remain = 1.0 - text_out

    draw.text(
        ((54 - round(24 * (1.0 - title_in))) * SCALE, 66 * SCALE),
        "ARECIBO LAB", font=typeface(64),
        fill=(248, 251, 252, round(255 * title_in * remain)),
    )
    rule = round(176 * smooth((time_seconds + 0.04) / 0.48) * remain)
    draw.rounded_rectangle(
        (56 * SCALE, 150 * SCALE, (56 + rule) * SCALE, 157 * SCALE),
        radius=4 * SCALE, fill=(*LIME, 255),
    )

    label_y = 1004 + round(18 * (1.0 - road_label_in))
    draw.text(
        (58 * SCALE, label_y * SCALE), "CARRETERA", font=typeface(31),
        fill=(190, 210, 220, round(255 * road_label_in * remain)),
    )
    number_y = 1035 + round(32 * (1.0 - number_in))
    draw.text(
        (52 * SCALE, number_y * SCALE), "683", font=typeface(132),
        fill=(248, 251, 252, round(255 * number_in * remain)),
        stroke_width=1 * SCALE, stroke_fill=(248, 251, 252, round(255 * number_in * remain)),
    )
    accent_width = round(280 * number_in * remain)
    draw.rounded_rectangle(
        (58 * SCALE, 1213 * SCALE, (58 + accent_width) * SCALE, 1222 * SCALE),
        radius=5 * SCALE, fill=(*LIME, round(255 * number_in * remain)),
    )

    hqj_y = 1262 + round(16 * (1.0 - hqj_in))
    draw.text(
        (60 * SCALE, hqj_y * SCALE), "FRENTE A HQJ", font=typeface(34),
        fill=(219, 230, 235, round(255 * hqj_in * remain)),
    )

    canvas = Image.alpha_composite(canvas, text_layer).convert("RGB")
    return canvas.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def render() -> list[Image.Image]:
    photo = Image.open(SOURCE).convert("RGB")
    process = subprocess.Popen(
        [
            FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-t", f"{DURATION:.1f}", str(OUTPUT),
        ],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    samples: list[Image.Image] = []
    sample_indices = {0, 27, 51, FRAMES - 1}
    for index in range(FRAMES):
        frame = make_frame(photo, index / FPS)
        if index in sample_indices:
            samples.append(frame.copy())
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed while rendering v6 location motion clip")
    return samples


def write_contact_sheet(samples: list[Image.Image]) -> None:
    thumb_w, thumb_h = 270, 480
    sheet = Image.new("RGB", (thumb_w * 4, thumb_h + 66), (7, 24, 36))
    draw = ImageDraw.Draw(sheet)
    labels = ("0.00s", "0.90s", "1.70s", "3.17s")
    label_font = ImageFont.truetype(str(FONT_PATH), 18)
    for index, (sample, label) in enumerate(zip(samples, labels)):
        sheet.paste(sample.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS), (index * thumb_w, 0))
        draw.text((index * thumb_w + 18, thumb_h + 20), label, font=label_font, fill=(232, 240, 244))
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, quality=95, subsampling=0)


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    samples = render()
    write_contact_sheet(samples)
    print(OUTPUT)
    print(CONTACT_SHEET)


if __name__ == "__main__":
    main()
