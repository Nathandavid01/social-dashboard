"""Placas de título Delian con el estilo de media/delian/graphics/habitos-title.png.

Caja violeta oscura translúcida, borde magenta, línea 1 blanca y línea 2 magenta,
Montserrat Bold en mayúsculas con sombra. PNG con alfa para graphics[] de pipeline.py.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / 'media/delian/brand/Montserrat-Bold.ttf'
FILL = (21, 12, 42, 232)
BORDER = (200, 70, 210, 255)
WHITE = (255, 255, 255, 255)
VIOLET = (235, 96, 229, 255)
SHADOW = (0, 0, 0, 150)


def fit(draw, text, size, limit):
    while size > 30:
        font = ImageFont.truetype(str(FONT), size)
        if draw.textlength(text, font=font) <= limit:
            return font
        size -= 2
    return ImageFont.truetype(str(FONT), size)


def plate(lines, output, width=720, size=64, margin=14):
    probe = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    fonts = [fit(probe, text, size if i == 0 else size, width - 2 * margin - 80) for i, text in enumerate(lines)]
    gap = 10
    heights = [f.getbbox(t)[3] - f.getbbox(t)[1] for f, t in zip(fonts, lines)]
    height = sum(heights) + gap * (len(lines) - 1) + 2 * margin + 76
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((margin, margin, width - margin, height - margin), radius=28,
                           fill=FILL, outline=BORDER, width=4)
    y = margin + 38
    for i, (text, font, h) in enumerate(zip(lines, fonts, heights)):
        top = font.getbbox(text)[1]
        x = (width - draw.textlength(text, font=font)) / 2
        draw.text((x + 3, y - top + 4), text, font=font, fill=SHADOW)
        draw.text((x, y - top), text, font=font, fill=WHITE if i == 0 else VIOLET)
        y += h + gap
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise SystemExit(f'Ya existe {output}; no se pisa')
    image.save(output)
    print(output, image.size)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output')
    parser.add_argument('lines', nargs='+')
    parser.add_argument('--width', type=int, default=720)
    parser.add_argument('--size', type=int, default=64)
    args = parser.parse_args()
    plate(args.lines, Path(args.output), args.width, args.size)
