#!/usr/bin/env python3
"""Build the v5 photographic motion overlay for Antes De Una Toma De Muestra.

The four source PNGs are generated illustrations of studio objects.  This script
only composes, sizes, and animates them; it does not represent them as source
footage from Arecibo Lab.
"""

from functools import lru_cache
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
FPS = 30
DURATION = 17.452
SUPER = 2
FRAME_SIZE = (1080, 1920)
SAFE_TOP = 930
SAFE_BOTTOM = 1320

ASSET_DIR = ROOT / "media/arecibo/muestra-photo-v5"
ASSETS = {
    "exercise": ASSET_DIR / "exercise.png",
    "drinks": ASSET_DIR / "drinks.png",
    "fasting": ASSET_DIR / "fasting.png",
    "hydrate": ASSET_DIR / "hydrate.png",
}
OUTPUT = ROOT / "media/arecibo/muestra-tips-graphics-v5.mov"
PREVIEWS = (
    (3.65, ROOT / "media/arecibo/muestra-tips-graphics-v5-preview-03_65.png"),
    (7.35, ROOT / "media/arecibo/muestra-tips-graphics-v5-preview-07_35.png"),
    (11.40, ROOT / "media/arecibo/muestra-tips-graphics-v5-preview-11_40.png"),
    (15.65, ROOT / "media/arecibo/muestra-tips-graphics-v5-preview-15_65.png"),
)

EVENTS = (
    (2.45, 5.90, "1", ("EVITA EJERCICIO", "INTENSO"), "24 H ANTES", "exercise"),
    (6.02, 8.68, "2", ("SIN CAFÉ NI", "BEBIDAS AZUCARADAS"), "", "drinks"),
    (8.90, 14.02, "3", ("AYUNO", ""), "", "fasting"),
    (14.23, 17.42, "4", ("HIDRÁTATE", "SIN ALCOHOL"), "AGUA SÍ", "hydrate"),
)

NAVY = (5, 28, 47, 255)
NAVY_2 = (11, 55, 74, 245)
GREEN = (156, 230, 8, 255)
WHITE = (255, 255, 255, 255)
MUTED = (199, 222, 229, 255)
BAN = (255, 82, 82, 255)


def s(value: float) -> int:
    return round(value * SUPER)


def sb(values):
    return tuple(s(value) for value in values)


@lru_cache(None)
def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(
        str(ROOT / "media/arecibo/brand/Montserrat-Bold.ttf"), s(size)
    )


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def validate_inputs() -> None:
    missing = [str(path) for path in ASSETS.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError(
            "All four v5 photographic assets are required before encoding:\n  "
            + "\n  ".join(missing)
        )
    problems = []
    for kind, path in ASSETS.items():
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                if image.width < 400 or image.height < 300:
                    problems.append(f"{kind}: only {image.width}x{image.height}")
        except Exception as error:
            problems.append(f"{kind}: {error}")
    if problems:
        raise ValueError("Invalid v5 asset(s):\n  " + "\n  ".join(problems))


@lru_cache(None)
def source_asset(kind: str) -> tuple[Image.Image, bool]:
    image = Image.open(ASSETS[kind]).convert("RGBA")
    extrema = image.getchannel("A").getextrema()
    has_transparency = extrema[0] < 250
    if has_transparency:
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox:
            image = image.crop(bbox)
    return image, has_transparency


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image, (s(size[0]), s(size[1])), Image.Resampling.LANCZOS)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((s(size[0]), s(size[1])), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (s(size[0]), s(size[1])))
    result.alpha_composite(copy, ((result.width - copy.width) // 2, (result.height - copy.height) // 2))
    return result


def scaled_photo(kind: str, phase: float) -> tuple[Image.Image, bool]:
    source, transparent = source_asset(kind)
    # A restrained push-in keeps the photographic hero alive during the hold.
    zoom = 1.0 + 0.026 * smoothstep(phase)
    box_size = (490, 350)
    if transparent:
        base = contain(source, box_size)
    else:
        base = cover(source, box_size)
        mask = Image.new("L", base.size)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, base.width - 1, base.height - 1), radius=s(30), fill=255
        )
        base.putalpha(mask)
    enlarged = base.resize(
        (round(base.width * zoom), round(base.height * zoom)), Image.Resampling.LANCZOS
    )
    left = (enlarged.width - base.width) // 2
    top = (enlarged.height - base.height) // 2
    return enlarged.crop((left, top, left + base.width, top + base.height)), transparent


@lru_cache(None)
def soft_backplate() -> Image.Image:
    width, height = s(940), s(350)
    plate = Image.new("RGBA", (width, height))
    pixels = plate.load()
    for y in range(height):
        fy = y / max(1, height - 1)
        for x in range(width):
            fx = x / max(1, width - 1)
            left_strength = max(0.0, 1.0 - fx / 0.72)
            edge = min(1.0, min(x, width - 1 - x, y, height - 1 - y) / s(28))
            alpha = round((218 * left_strength + 55 * (1.0 - left_strength)) * smoothstep(edge))
            pixels[x, y] = (5 + round(5 * fy), 28 + round(15 * fy), 47 + round(16 * fy), alpha)
    return plate


def draw_centered(draw: ImageDraw.ImageDraw, center_x: float, y: float, value: str, size: int, fill) -> None:
    bbox = draw.textbbox((0, 0), value, font=font(size))
    draw.text((s(center_x) - (bbox[2] - bbox[0]) // 2, s(y)), value, font=font(size), fill=fill)


def draw_ban_mark(layer: Image.Image, kind: str) -> None:
    # The hydrate slash is constrained to the right third, over the wine only.
    if kind == "hydrate":
        cx, cy, radius = 832, 1115, 90
    elif kind == "exercise":
        cx, cy, radius = 793, 1110, 150
    else:
        cx, cy, radius = 790, 1110, 150
    draw = ImageDraw.Draw(layer)
    draw.ellipse(sb((cx - radius, cy - radius, cx + radius, cy + radius)), outline=BAN, width=s(13))
    offset = radius * 0.69
    draw.line(
        [(s(cx - offset), s(cy + offset)), (s(cx + offset), s(cy - offset))],
        fill=BAN,
        width=s(17),
    )
    draw.line(
        [(s(cx - offset + 3), s(cy + offset - 2)), (s(cx + offset + 3), s(cy - offset - 2))],
        fill=(255, 185, 173, 145),
        width=s(4),
    )


def build_unit(number: str, lines: tuple[str, str], note: str, kind: str, phase: float) -> Image.Image:
    unit = Image.new("RGBA", (s(FRAME_SIZE[0]), s(FRAME_SIZE[1])))

    shadow = Image.new("RGBA", unit.size)
    ImageDraw.Draw(shadow).rounded_rectangle(sb((72, 954, 1018, 1306)), radius=s(42), fill=(0, 0, 0, 92))
    shadow = shadow.filter(ImageFilter.GaussianBlur(s(22)))
    unit = Image.alpha_composite(unit, shadow)
    unit.alpha_composite(soft_backplate(), (s(70), s(940)))

    draw = ImageDraw.Draw(unit)
    draw.rounded_rectangle(sb((91, 979, 193, 1063)), radius=s(42), fill=GREEN)
    draw_centered(draw, 142, 984, number, 54, NAVY)

    first_size = 54 if kind == "fasting" else (43 if len(lines[0]) < 16 else 37)
    second_size = 43 if len(lines[1]) < 17 else 33
    draw.text(sb((92, 1080)), lines[0], font=font(first_size), fill=WHITE)
    if lines[1]:
        draw.text(sb((92, 1138)), lines[1], font=font(second_size), fill=GREEN if kind != "hydrate" else WHITE)
    if note:
        draw.rounded_rectangle(sb((92, 1210, 407, 1268)), radius=s(29), fill=NAVY_2, outline=(156, 230, 8, 155), width=s(2))
        draw.text(sb((118, 1222)), note, font=font(25), fill=MUTED if kind != "hydrate" else GREEN)

    photo, transparent = scaled_photo(kind, phase)
    photo_x, photo_y = 505, 946
    if transparent:
        alpha = photo.getchannel("A")
        tint = Image.new("RGBA", photo.size, (0, 0, 0, 130))
        tint.putalpha(alpha.point(lambda value: round(value * 0.52)))
        tint = tint.filter(ImageFilter.GaussianBlur(s(15)))
        unit.alpha_composite(tint, (s(photo_x + 10), s(photo_y + 18)))
    else:
        draw = ImageDraw.Draw(unit)
        draw.rounded_rectangle(sb((493, 934, 1007, 1308)), radius=s(35), outline=(156, 230, 8, 175), width=s(3))
    unit.alpha_composite(photo, (s(photo_x), s(photo_y)))

    if kind in {"exercise", "drinks", "hydrate"}:
        draw_ban_mark(unit, kind)
    return unit


def frame_at(t: float) -> Image.Image:
    frame = Image.new("RGBA", (s(FRAME_SIZE[0]), s(FRAME_SIZE[1])))
    for start, end, number, lines, note, kind in EVENTS:
        if not start <= t < end:
            continue
        enter = smoothstep((t - start) / 0.24)
        leave = smoothstep((t - (end - 0.24)) / 0.24)
        visibility = enter * (1.0 - leave)
        phase = (t - start) / max(0.01, end - start)
        unit = build_unit(number, lines, note, kind, phase)

        # The complete unit moves and fades together; safety masks protect face/captions.
        shift_x = round(s(34 * (1.0 - enter) - 24 * leave))
        shift_y = round(s(18 * (1.0 - enter) + 14 * leave))
        moved = Image.new("RGBA", frame.size)
        moved.alpha_composite(unit, (shift_x, shift_y))
        alpha = moved.getchannel("A").point(lambda value: round(value * visibility))
        alpha_draw = ImageDraw.Draw(alpha)
        alpha_draw.rectangle((0, 0, frame.width, s(SAFE_TOP)), fill=0)
        alpha_draw.rectangle((0, s(SAFE_BOTTOM), frame.width, frame.height), fill=0)
        moved.putalpha(alpha)
        frame = Image.alpha_composite(frame, moved)
    result = frame.resize(FRAME_SIZE, Image.Resampling.LANCZOS)
    # Reassert the caption boundary after downsampling so no antialias fringe
    # survives on or below y=1320.
    result_alpha = result.getchannel("A")
    ImageDraw.Draw(result_alpha).rectangle((0, SAFE_BOTTOM, FRAME_SIZE[0], FRAME_SIZE[1]), fill=0)
    result.putalpha(result_alpha)
    return result


def render() -> None:
    validate_inputs()
    targets = (OUTPUT,) + tuple(path for _, path in PREVIEWS)
    existing = [str(path) for path in targets if path.exists()]
    if existing:
        raise FileExistsError("Refusing to overwrite v5 output(s): " + ", ".join(existing))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    command = [
        FFMPEG,
        "-v", "error",
        "-f", "rawvideo",
        "-pix_fmt", "rgba",
        "-s", "1080x1920",
        "-r", str(FPS),
        "-i", "-",
        "-an",
        "-c:v", "qtrle",
        str(OUTPUT),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for index in range(round(DURATION * FPS)):
            process.stdin.write(frame_at(index / FPS).tobytes())
    except Exception:
        process.kill()
        OUTPUT.unlink(missing_ok=True)
        raise
    finally:
        process.stdin.close()
    if process.wait() != 0:
        OUTPUT.unlink(missing_ok=True)
        raise RuntimeError("ffmpeg qtrle encoding failed")
    for timestamp, path in PREVIEWS:
        frame_at(timestamp).save(path)


if __name__ == "__main__":
    render()
