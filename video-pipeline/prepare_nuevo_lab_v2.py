"""Build the real-photo location shot and v2 recipe for Nuevo Laboratorio En Arecibo."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
DURATION = 3.17
FPS = 30

DOWNLOADS = Path("/Users/ericperez/Downloads/drive-download-20260916T014935Z-1-001")
RECEPTION_SOURCE = DOWNLOADS / "DJI_20260909092322_0276_D.MP4"
FACADE_SOURCE = DOWNLOADS / "DJI_20260909100140_0296_D.JPG"

RECEPTION_DEST = ROOT / "media/arecibo/DJI_20260909092322_0276_D.MP4"
FACADE_DEST = ROOT / "media/arecibo/DJI_20260909100140_0296_D.JPG"
LOCATION_VIDEO = ROOT / "media/arecibo/nuevo-lab-location-v3.mp4"
LOCATION_PREVIEW = ROOT / "runs/arecibo-nuevo-lab-location-v3-preview.png"
FONT_PATH = ROOT / "media/arecibo/brand/Montserrat-Bold.ttf"


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size)


def cover_photo(photo: Image.Image, t: float) -> Image.Image:
    """Vertical crop with a slow, stable push toward the real exterior sign."""
    width, height = photo.size
    base_crop_width = round(height * 9 / 16)
    zoom = 1.0 + 0.055 * ease(t / DURATION)
    crop_width = round(base_crop_width / zoom)
    crop_height = round(height / zoom)
    center_x = 2350 - round(55 * ease(t / DURATION))
    center_y = height // 2 - round(24 * ease(t / DURATION))
    left = max(0, min(width - crop_width, center_x - crop_width // 2))
    top = max(0, min(height - crop_height, center_y - crop_height // 2))
    return photo.crop((left, top, left + crop_width, top + crop_height)).resize(
        (1080, 1920), Image.Resampling.LANCZOS
    )


def draw_pin(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float) -> None:
    radius = round(20 * scale)
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline="#9CE608", width=6)
    draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill="#9CE608")
    draw.polygon(
        [(x - round(13 * scale), y + round(15 * scale)),
         (x + round(13 * scale), y + round(15 * scale)),
         (x, y + round(43 * scale))],
        fill="#9CE608",
    )


def make_frame(photo: Image.Image, t: float) -> Image.Image:
    frame = cover_photo(photo, t).convert("RGBA")

    # Filmic contrast and a restrained cool shadow treatment.
    arr = np.asarray(frame.convert("RGB"), dtype=np.float32)
    arr = np.clip((arr - 128.0) * 1.045 + 128.0, 0, 255)
    arr[:, :, 0] *= 0.97
    arr[:, :, 2] *= 1.025
    frame = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")

    shade = Image.new("RGBA", frame.size)
    shade_arr = np.zeros((1920, 1080, 4), dtype=np.uint8)
    shade_arr[:, :, :3] = (5, 22, 32)
    for y in range(1920):
        strength = 18 + round(118 * ease((y - 520) / 1400))
        shade_arr[y, :, 3] = strength
    shade = Image.fromarray(shade_arr, "RGBA")
    frame = Image.alpha_composite(frame, shade)

    # Opaque editorial card covers the source's dated opening banner.
    enter = ease((t - 0.06) / 0.42)
    exit_progress = ease((t - (DURATION - 0.34)) / 0.34)
    alpha = enter * (1.0 - 0.35 * exit_progress)
    offset_x = round(70 * (1.0 - enter) - 22 * exit_progress)
    card = Image.new("RGBA", (900, 740), (7, 29, 41, 255))
    shadow = Image.new("RGBA", card.size)
    ImageDraw.Draw(shadow).rounded_rectangle(
        (10, 18, 890, 732), radius=34, fill=(0, 0, 0, 125)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    card = Image.alpha_composite(shadow, card)
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle(
        (2, 2, 897, 728), radius=30, fill=(7, 29, 41, 255),
        outline=(188, 225, 230, 80), width=2,
    )

    draw_pin(card_draw, 92, 101, 1.0)
    card_draw.text((145, 66), "ARECIBO LAB", font=font(37), fill=(179, 214, 123, round(255 * alpha)))
    card_draw.text((62, 170), "CARRETERA 683", font=font(68), fill=(247, 250, 251, round(255 * alpha)))
    card_draw.text((64, 274), "FRENTE A HQJ", font=font(50), fill=(210, 226, 232, round(255 * alpha)))

    line_end = 64 + round(710 * ease((t - 0.30) / 0.82))
    card_draw.line((64, 391, line_end, 391), fill=(156, 230, 8, round(255 * alpha)), width=7)
    card_draw.ellipse((line_end - 8, 383, line_end + 8, 399), fill=(156, 230, 8, round(255 * alpha)))

    layer = Image.new("RGBA", frame.size)
    layer.alpha_composite(card, (90 + offset_x, 740))
    frame = Image.alpha_composite(frame, layer)

    # Thin registration lines keep the motion graphic tied to the architecture.
    marks = Image.new("RGBA", frame.size)
    mark_draw = ImageDraw.Draw(marks)
    mark_alpha = round(155 * enter * (1.0 - exit_progress))
    mark_draw.line((52, 156, 218, 156), fill=(156, 230, 8, mark_alpha), width=3)
    mark_draw.line((52, 156, 52, 266), fill=(156, 230, 8, mark_alpha), width=3)
    mark_draw.line((1028, 1660, 862, 1660), fill=(211, 229, 235, mark_alpha), width=2)
    mark_draw.line((1028, 1660, 1028, 1550), fill=(211, 229, 235, mark_alpha), width=2)
    return Image.alpha_composite(frame, marks).convert("RGB")


def render_location_video() -> None:
    photo = Image.open(FACADE_DEST).convert("RGB")
    process = subprocess.Popen(
        [
            FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", "1080x1920", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
            "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(LOCATION_VIDEO),
        ],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    preview_index = round(1.35 * FPS)
    # Round upward so an edit ending exactly at DURATION never exceeds the encoded source by one frame.
    for index in range(math.ceil(DURATION * FPS)):
        frame = make_frame(photo, index / FPS)
        if index == preview_index:
            frame.save(LOCATION_PREVIEW)
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed while rendering the location shot")


def write_recipe() -> None:
    source_recipe = ROOT / "edits/arecibo-nuevo-lab-0281-v1.json"
    edit = json.loads(source_recipe.read_text())
    edit["broll"] = [
        {
            "source": "../media/arecibo/DJI_20260909092322_0276_D.MP4",
            "in": 0.3,
            "out": 1.8,
            "at": 0.98,
            "reason": "Recepción real, vacía y con el logo visible cuando se presenta el nuevo laboratorio; toma inédita en las ediciones actuales.",
            "zoom_keyframes": [{"time": 0, "zoom": 1.0}, {"time": 1.5, "zoom": 1.04}],
            "fade_in": 0.08,
            "fade_out": 0.08,
        },
        {
            "source": "../media/arecibo/nuevo-lab-location-v3.mp4",
            "in": 0,
            "out": DURATION,
            "at": 2.48,
            "kind": "brand_graphic",
            "original_source": "media/arecibo/DJI_20260909100140_0296_D.JPG",
            "reason": "Movimiento cinematográfico creado con una foto real de la fachada. La tarjeta de ubicación cubre el anuncio antiguo y conserva solamente la dirección vigente grabada.",
            "fade_in": 0.08,
            "fade_out": 0,
        },
    ]
    edit["previous_version"] = "../runs/arecibo-nuevo-lab-0281-v2.mp4"
    edit["review_notes"] = [
        "Nueva pieza desde 0281: se retira la claqueta y se conserva el gancho completo hasta Arecibo Lab.",
        "Se omite la frase intermedia de servicios porque el reconocimiento automático no resuelve con suficiente certeza su inicio. No se inventan palabras ni servicios.",
        "Se enlaza directamente con la ubicación grabada. La vía se rotula 683, corrección ya verificada en el perfil del cliente.",
        "v3 usa una recepción real inédita y una foto real de la fachada con movimiento cinematográfico. La tarjeta cubre el anuncio con fecha vieja desde el primer fotograma y muestra la ubicación vigente.",
        "Montserrat 70 fijo, captions verdes, zooms discretos, dos efectos ligados a cambios reales y outro oficial ya sonorizado.",
        "Música Be Chillin CC0, distinta a las camas usadas en las piezas recientes. Escucha crítica y aprobación final pendientes.",
    ]
    destination = ROOT / "edits/arecibo-nuevo-lab-0281-v3.json"
    destination.write_text(json.dumps(edit, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    for source, destination in ((RECEPTION_SOURCE, RECEPTION_DEST), (FACADE_SOURCE, FACADE_DEST)):
        if not source.is_file():
            raise FileNotFoundError(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copy2(source, destination)
    render_location_video()
    write_recipe()
    print(LOCATION_VIDEO)
    print(ROOT / "edits/arecibo-nuevo-lab-0281-v3.json")


if __name__ == "__main__":
    main()
