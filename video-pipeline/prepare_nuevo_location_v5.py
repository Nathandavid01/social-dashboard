"""Render the standalone v5 location motion clip for Nuevo Laboratorio."""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media/arecibo/DJI_20260909100140_0296_D.JPG"
OUTPUT = ROOT / "media/arecibo/nuevo-lab-location-v5.mp4"
CONTACT_SHEET = ROOT / "runs/arecibo-nuevo-lab-location-v5-contact-sheet.jpg"
FONT_PATH = ROOT / "media/arecibo/brand/Montserrat-Bold.ttf"
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"

WIDTH, HEIGHT = 1080, 1920
FPS = 30
DURATION = 3.2
FRAMES = math.ceil(DURATION * FPS)
NAVY = (5, 22, 34)
LIME = (156, 230, 8)


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def smooth(value: float) -> float:
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size)


def grade(image: Image.Image) -> Image.Image:
    image = ImageEnhance.Contrast(image).enhance(1.07)
    image = ImageEnhance.Color(image).enhance(0.90)
    values = np.asarray(image, dtype=np.float32)
    values[:, :, 0] *= 0.96
    values[:, :, 1] *= 1.01
    values[:, :, 2] *= 1.055
    return Image.fromarray(np.clip(values, 0, 255).astype(np.uint8), "RGB")


def architectural_crop(photo: Image.Image, progress: float) -> Image.Image:
    """Use only the upper architecture/logo; the dated lower banner is outside the crop."""
    # The source is 3840x2160. This window ends at y=1115, well above the banner.
    base = photo.crop((380, 0, 3460, 1115))
    zoom = 1.0 + 0.035 * smooth(progress)
    crop_width = round(base.width / zoom)
    crop_height = round(base.height / zoom)
    shift_x = round(36 * smooth(progress))
    left = min(base.width - crop_width, max(0, (base.width - crop_width) // 2 + shift_x))
    top = min(base.height - crop_height, max(0, (base.height - crop_height) // 2))
    base = base.crop((left, top, left + crop_width, top + crop_height))
    return grade(base.resize((920, 690), Image.Resampling.LANCZOS))


def background() -> Image.Image:
    arr = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for y in range(HEIGHT):
        p = y / (HEIGHT - 1)
        glow = math.exp(-((p - 0.28) / 0.30) ** 2)
        arr[y, :, 0] = 5 + round(4 * glow)
        arr[y, :, 1] = 20 + round(14 * glow)
        arr[y, :, 2] = 33 + round(20 * glow)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def make_frame(photo: Image.Image, time_seconds: float) -> Image.Image:
    progress = time_seconds / DURATION
    frame = background()

    photo_in = smooth((time_seconds - 0.02) / 0.48)
    photo_y = 300 + round(34 * (1.0 - photo_in))
    photo_layer = Image.new("RGBA", (WIDTH, HEIGHT))
    still = architectural_crop(photo, progress).convert("RGBA")
    still.putalpha(round(255 * photo_in))

    shadow = Image.new("RGBA", (944, 714), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((12, 12, 932, 702), 28, fill=(0, 0, 0, 155))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    photo_layer.alpha_composite(shadow, (68, photo_y - 2))

    mask = Image.new("L", still.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, still.width - 1, still.height - 1), 24, fill=255)
    still.putalpha(Image.eval(mask, lambda value: value * round(255 * photo_in) // 255))
    photo_layer.alpha_composite(still, (80, photo_y))

    border = ImageDraw.Draw(photo_layer)
    border.rounded_rectangle(
        (79, photo_y - 1, 1000, photo_y + 690), 25,
        outline=(215, 232, 239, round(92 * photo_in)), width=2,
    )
    frame = Image.alpha_composite(frame, photo_layer)

    # Text enters in sequence and clears before the cut, while the photograph remains.
    title_in = smooth((time_seconds - 0.18) / 0.42)
    address_in = smooth((time_seconds - 0.48) / 0.44)
    text_out = smooth((time_seconds - 2.84) / 0.28)
    text_alpha = 1.0 - text_out

    typography = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(typography)

    title_x = 80 + round(42 * (1.0 - title_in))
    draw.text(
        (title_x, 132), "ARECIBO LAB", font=font(82),
        fill=(247, 250, 251, round(255 * title_in * text_alpha)),
    )
    line_width = round(212 * smooth((time_seconds - 0.32) / 0.48) * text_alpha)
    draw.rounded_rectangle((80, 242, 80 + line_width, 250), 4, fill=(*LIME, 255))

    address_y = 1058 + round(24 * (1.0 - address_in))
    draw.text(
        (82, address_y), "CARRETERA 683", font=font(63),
        fill=(247, 250, 251, round(255 * address_in * text_alpha)),
    )
    draw.text(
        (84, address_y + 88), "FRENTE A HQJ", font=font(42),
        fill=(185, 205, 216, round(255 * address_in * text_alpha)),
    )
    draw.ellipse(
        (80, address_y + 169, 92, address_y + 181),
        fill=(*LIME, round(255 * address_in * text_alpha)),
    )
    draw.line(
        (106, address_y + 175, 322, address_y + 175),
        fill=(*LIME, round(185 * address_in * text_alpha)), width=3,
    )
    return Image.alpha_composite(frame, typography).convert("RGB")


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
    sample_indices = {0, FRAMES // 2, FRAMES - 1}
    for index in range(FRAMES):
        frame = make_frame(photo, index / FPS)
        if index in sample_indices:
            samples.append(frame.copy())
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed while rendering v5 location motion clip")
    return samples


def write_contact_sheet(samples: list[Image.Image]) -> None:
    thumb_width, thumb_height = 360, 640
    sheet = Image.new("RGB", (thumb_width * 3, thumb_height + 72), (7, 24, 36))
    draw = ImageDraw.Draw(sheet)
    labels = ("START  0.00s", "MIDDLE  1.60s", "END  3.17s")
    for index, (sample, label) in enumerate(zip(samples, labels)):
        sheet.paste(sample.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS), (index * thumb_width, 0))
        draw.text((index * thumb_width + 22, thumb_height + 20), label, font=font(19), fill=(232, 240, 244))
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, quality=94, subsampling=0)


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    if not FONT_PATH.is_file():
        raise FileNotFoundError(FONT_PATH)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    samples = render()
    write_contact_sheet(samples)
    print(OUTPUT)
    print(CONTACT_SHEET)


if __name__ == "__main__":
    main()
