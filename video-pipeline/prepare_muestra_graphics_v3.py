#!/usr/bin/env python3
"""Render the v3 transparent motion cards for Antes De Una Toma De Muestra."""

from functools import lru_cache
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
FPS = 30
BODY_DURATION = 17.452
SUPER = 2
FRAME_SIZE = (1080, 1920)
CARD_SIZE = (920, 300)
CARD_POS = (80, 970)
OUTPUT = ROOT / "media/arecibo/muestra-tips-graphics-v3.mov"
PREVIEWS = (
    (3.5, ROOT / "media/arecibo/muestra-tips-graphics-v3-preview-03_50.png"),
    (7.1, ROOT / "media/arecibo/muestra-tips-graphics-v3-preview-07_10.png"),
    (12.5, ROOT / "media/arecibo/muestra-tips-graphics-v3-preview-12_50.png"),
    (15.7, ROOT / "media/arecibo/muestra-tips-graphics-v3-preview-15_70.png"),
)

EVENTS = (
    (2.45, 5.90, "1", "EVITA EJERCICIO INTENSO", "exercise"),
    (6.02, 8.68, "2", "EVITA ESTAS BEBIDAS", "drinks"),
    (8.90, 14.02, "3", "AYUNO", "fasting"),
    (14.23, 17.42, "4", "HIDRÁTATE · EVITA ALCOHOL", "hydrate"),
)


@lru_cache(None)
def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(
        str(ROOT / "media/arecibo/brand/Montserrat-Bold.ttf"), size * SUPER
    )


def s(value: float) -> int:
    return round(value * SUPER)


def box(values):
    return tuple(s(value) for value in values)


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def line(draw: ImageDraw.ImageDraw, points, fill, width: float):
    draw.line(
        [(s(x), s(y)) for x, y in points],
        fill=fill,
        width=s(width),
        joint="curve",
    )


def text(draw: ImageDraw.ImageDraw, xy, value: str, size: int, fill, **kwargs):
    draw.text(box(xy), value, font=font(size), fill=fill, **kwargs)


@lru_cache(None)
def gradient_card() -> Image.Image:
    width, height = CARD_SIZE
    layer = Image.new("RGBA", (s(width), s(height)))
    pixels = layer.load()
    for y in range(s(height)):
        fy = y / max(1, s(height) - 1)
        for x in range(s(width)):
            fx = x / max(1, s(width) - 1)
            glow = max(0.0, 1.0 - math.hypot(fx - 0.78, fy - 0.18) / 0.72)
            r = round(5 + 6 * fy + 4 * glow)
            g = round(25 + 13 * fy + 22 * glow)
            b = round(42 + 15 * fy + 27 * glow)
            pixels[x, y] = (r, g, b, 248)
    mask = Image.new("L", layer.size)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, layer.width - 1, layer.height - 1), radius=s(34), fill=255
    )
    layer.putalpha(mask)
    return layer


def draw_ban(draw, x1, y1, x2, y2):
    line(draw, [(x1, y1), (x2, y2)], (156, 230, 8, 255), 15)
    line(draw, [(x1 + 2, y1 + 1), (x2 + 2, y2 + 1)], (214, 255, 113, 135), 4)


def exercise_icon(draw, phase: float):
    bob = 3 * math.sin(phase * math.pi)
    # A dimensional dumbbell with an explicit prohibition slash.
    line(draw, [(625, 144 + bob), (801, 144 + bob)], (223, 238, 243, 255), 24)
    for cx in (602, 824):
        draw.rounded_rectangle(box((cx - 24, 91 + bob, cx + 24, 197 + bob)), radius=s(11), fill=(56, 127, 154, 255), outline=(126, 195, 216, 255), width=s(4))
        draw.rounded_rectangle(box((cx - 47, 110 + bob, cx + 47, 178 + bob)), radius=s(14), fill=(30, 78, 100, 255), outline=(89, 165, 191, 255), width=s(4))
    draw_ban(draw, 557, 226, 859, 54)
    draw.rounded_rectangle(box((724, 211, 864, 273)), radius=s(20), fill=(10, 38, 54, 245), outline=(156, 230, 8, 255), width=s(3))
    text(draw, (746, 219), "24 H", 38, "#FFFFFF")


def drinks_icon(draw, phase: float):
    lift = 5 * (1.0 - phase)
    # Coffee cup.
    draw.rounded_rectangle(box((568, 94 + lift, 687, 208 + lift)), radius=s(19), fill=(229, 239, 241, 255), outline=(110, 168, 188, 255), width=s(4))
    draw.ellipse(box((660, 116 + lift, 724, 190 + lift)), outline=(229, 239, 241, 255), width=s(13))
    for x in (601, 640):
        line(draw, [(x, 78), (x - 8, 58), (x + 1, 35)], (130, 182, 199, 210), 5)
    # Sugary cold drink, with bubbles rather than tiny explanatory copy.
    draw.polygon([(s(757), s(73)), (s(855), s(73)), (s(838), s(225)), (s(774), s(225))], fill=(60, 164, 201, 255))
    draw.polygon([(s(768), s(139)), (s(847), s(139)), (s(838), s(225)), (s(777), s(225))], fill=(237, 119, 72, 235))
    line(draw, [(799, 76), (831, 34)], "#EDF7F9", 8)
    for x, y, radius in ((792, 170, 6), (818, 192, 5), (806, 211, 4)):
        draw.ellipse(box((x - radius, y - radius, x + radius, y + radius)), fill=(255, 230, 153, 205))
    draw_ban(draw, 548, 243, 874, 48)


def fasting_icon(draw, phase: float):
    pulse = 1.0 + 0.025 * math.sin(phase * math.pi)
    cx, cy = 710, 151
    rx, ry = 126 * pulse, 108 * pulse
    draw.ellipse(box((cx - rx, cy - ry, cx + rx, cy + ry)), fill=(224, 237, 240, 255), outline=(156, 230, 8, 255), width=s(7))
    draw.ellipse(box((cx - 75, cy - 63, cx + 75, cy + 63)), fill=(11, 42, 57, 255), outline=(100, 153, 174, 255), width=s(4))
    text(draw, (627, 126), "AYUNO", 33, "#FFFFFF")
    # Fork and knife are large enough to read at phone size.
    line(draw, [(558, 66), (558, 237)], (100, 190, 221, 255), 10)
    for x in (540, 552, 564, 576):
        line(draw, [(x, 58), (x, 104)], (100, 190, 221, 255), 6)
    line(draw, [(854, 64), (854, 237)], (100, 190, 221, 255), 10)
    draw.polygon([(s(854), s(64)), (s(886), s(161)), (s(854), s(161))], fill=(100, 190, 221, 255))


def hydration_icon(draw, phase: float):
    shimmer = round(10 * math.sin(phase * math.pi))
    # Water droplet: the positive half of the grouped fourth point.
    drop = [(615, 45), (548, 137), (545, 178), (561, 218), (594, 242), (632, 241), (666, 215), (681, 177), (672, 136)]
    draw.polygon([(s(x), s(y)) for x, y in drop], fill=(52, 170 + shimmer, 218 + min(shimmer, 10), 255))
    draw.ellipse(box((574, 139, 618, 192)), fill=(177, 235, 248, 185))
    # A stemmed glass and slash: the alcohol prohibition half.
    draw.polygon([(s(755), s(67)), (s(866), s(67)), (s(842), s(172)), (s(779), s(172))], fill=(228, 239, 242, 238))
    draw.polygon([(s(771), s(123)), (s(851), s(123)), (s(840), s(165)), (s(782), s(165))], fill=(181, 83, 76, 235))
    line(draw, [(811, 171), (811, 222)], (228, 239, 242, 255), 9)
    line(draw, [(772, 225), (850, 225)], (228, 239, 242, 255), 9)
    draw_ban(draw, 731, 246, 890, 45)


def build_card(number: str, label: str, kind: str, phase: float) -> Image.Image:
    card = gradient_card().copy()
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(box((1, 1, 918, 298)), radius=s(34), outline=(103, 153, 173, 155), width=s(2))
    draw.rounded_rectangle(box((0, 0, 15, 299)), radius=s(7), fill=(156, 230, 8, 255))
    draw.ellipse(box((38, 48, 144, 154)), fill=(19, 59, 76, 255), outline=(156, 230, 8, 255), width=s(4))
    bbox = draw.textbbox((0, 0), number, font=font(58))
    number_w = bbox[2] - bbox[0]
    text(draw, ((91 * SUPER - number_w / 2) / SUPER, 63), number, 58, "#FFFFFF")

    label_size = 44 if len(label) <= 20 else 40
    max_width = s(430)
    if draw.textbbox((0, 0), label, font=font(label_size))[2] > max_width:
        if kind == "hydrate":
            text(draw, (176, 70), "HIDRÁTATE", 44, "#FFFFFF")
            text(draw, (176, 129), "EVITA ALCOHOL", 40, "#9CE608")
        elif kind == "exercise":
            text(draw, (176, 67), "EVITA EJERCICIO", 40, "#FFFFFF")
            text(draw, (176, 122), "INTENSO", 46, "#9CE608")
        elif kind == "drinks":
            text(draw, (176, 67), "CAFÉ Y", 44, "#FFFFFF")
            text(draw, (176, 122), "BEBIDAS", 44, "#9CE608")
        else:
            text(draw, (176, 96), label, label_size, "#FFFFFF")
    else:
        text(draw, (176, 96), label, label_size, "#FFFFFF")

    # Short progress strip animates inside the card without competing with copy.
    draw.rounded_rectangle(box((176, 216, 488, 226)), radius=s(5), fill=(66, 101, 116, 170))
    draw.rounded_rectangle(box((176, 216, 176 + 312 * phase, 226)), radius=s(5), fill=(156, 230, 8, 255))

    {"exercise": exercise_icon, "drinks": drinks_icon, "fasting": fasting_icon, "hydrate": hydration_icon}[kind](draw, phase)
    return card.resize(CARD_SIZE, Image.Resampling.LANCZOS)


def frame_at(t: float) -> Image.Image:
    frame = Image.new("RGBA", FRAME_SIZE)
    for start, end, number, label, kind in EVENTS:
        if not start <= t < end:
            continue
        enter = smoothstep((t - start) / 0.24)
        leave = smoothstep((t - (end - 0.24)) / 0.24)
        visibility = enter * (1.0 - leave)
        phase = smoothstep((t - start) / max(0.01, end - start))
        x = CARD_POS[0] + round(38 * (1.0 - enter) - 26 * leave)
        y = CARD_POS[1] + round(22 * (1.0 - enter) + 16 * leave)

        unit = Image.new("RGBA", FRAME_SIZE)
        shadow = Image.new("RGBA", FRAME_SIZE)
        ImageDraw.Draw(shadow).rounded_rectangle(
            (x + 8, y + 18, x + CARD_SIZE[0] - 8, y + CARD_SIZE[1] + 14),
            radius=34,
            fill=(0, 0, 0, 118),
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(18))
        unit = Image.alpha_composite(unit, shadow)
        unit.alpha_composite(build_card(number, label, kind, phase), (x, y))
        unit_alpha = unit.getchannel("A").point(lambda alpha: round(alpha * visibility))
        # Hard safety boundary: captions begin below y=1320 in the finished edit.
        ImageDraw.Draw(unit_alpha).rectangle((0, 1320, FRAME_SIZE[0], FRAME_SIZE[1]), fill=0)
        unit.putalpha(unit_alpha)
        frame = Image.alpha_composite(frame, unit)
    return frame


def render():
    paths = (OUTPUT,) + tuple(path for _, path in PREVIEWS)
    existing = [str(path) for path in paths if path.exists()]
    if existing:
        raise FileExistsError("Refusing to overwrite existing v3 output(s): " + ", ".join(existing))
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
        for index in range(round(BODY_DURATION * FPS)):
            process.stdin.write(frame_at(index / FPS).tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0:
        OUTPUT.unlink(missing_ok=True)
        raise RuntimeError("ffmpeg qtrle encoding failed")
    for timestamp, path in PREVIEWS:
        frame_at(timestamp).save(path)


if __name__ == "__main__":
    render()
