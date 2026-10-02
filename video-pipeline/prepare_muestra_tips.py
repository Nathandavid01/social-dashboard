#!/usr/bin/env python3
"""Build the Arecibo Lab pre-sample tips reel and native-resolution graphics."""

from functools import lru_cache
import json
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parent
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
FPS = 30
BODY_DURATION = 20.39
SUPER = 2


@lru_cache(None)
def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(
        str(ROOT / "media/arecibo/brand/Montserrat-Bold.ttf"), size * SUPER
    )


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def scale_box(values):
    return tuple(round(value * SUPER) for value in values)


def draw_text(draw, xy, text, size, fill, **kwargs):
    draw.text(scale_box(xy), text, font=font(size), fill=fill, **kwargs)


def draw_line(draw, points, fill, width):
    draw.line(
        [(round(x * SUPER), round(y * SUPER)) for x, y in points],
        fill=fill,
        width=round(width * SUPER),
        joint="curve",
    )


def card(t: float, start: float, end: float, number: str, label: str, kind: str):
    if not start <= t < end:
        return None

    enter = ease((t - start) / 0.24)
    leave = ease((t - (end - 0.24)) / 0.24)
    alpha = enter * (1 - leave)
    width, height = 920, 300
    canvas = Image.new("RGBA", (width * SUPER, height * SUPER))
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle(
        scale_box((0, 0, width - 1, height - 1)),
        radius=32 * SUPER,
        fill=(8, 31, 44, 239),
        outline=(112, 154, 169, 185),
        width=2 * SUPER,
    )
    draw.rounded_rectangle(
        scale_box((0, 0, 12, height - 1)),
        radius=5 * SUPER,
        fill="#9CE608",
    )
    draw_text(draw, (46, 35), number, 76, "#9CE608")
    draw_text(draw, (48, 132), label, 22, "#EAF3F6")
    draw_line(draw, [(48, 190), (180, 190)], "#527281", 2)
    draw_text(draw, (48, 216), "ANTES DE TU MUESTRA", 12, "#8DAAB7")

    # Large, shaded pictograms carry the idea without adding new medical claims.
    icon = Image.new("RGBA", canvas.size)
    pen = ImageDraw.Draw(icon)
    cx, cy = 650, 145

    if kind == "exercise":
        # Stopwatch and motion arc.
        pen.ellipse(scale_box((cx - 91, cy - 91, cx + 91, cy + 91)), fill=(16, 48, 63, 255), outline="#9CE608", width=8 * SUPER)
        pen.rounded_rectangle(scale_box((cx - 28, cy - 125, cx + 28, cy - 94)), radius=9 * SUPER, fill="#9CE608")
        draw_line(pen, [(cx, cy), (cx + 47, cy - 34)], "#EAF6F8", 10)
        draw_line(pen, [(cx, cy), (cx, cy - 59)], "#46B8DD", 7)
        pen.ellipse(scale_box((cx - 10, cy - 10, cx + 10, cy + 10)), fill="white")
        draw_text(pen, (778, 82), "24", 54, "white")
        draw_text(pen, (786, 148), "HORAS", 17, "#9CE608")
    elif kind == "drinks":
        # Coffee cup and a cold drink, crossed as one simple visual instruction.
        pen.rounded_rectangle(scale_box((550, 84, 675, 206)), radius=20 * SUPER, fill=(231, 241, 243, 255))
        pen.ellipse(scale_box((644, 108, 712, 183)), outline="#46B8DD", width=11 * SUPER)
        for x in (578, 612):
            draw_line(pen, [(x, 72), (x - 8, 50), (x + 2, 28)], "#8DAAB7", 5)
        pen.rounded_rectangle(scale_box((743, 61, 824, 213)), radius=17 * SUPER, fill=(64, 184, 221, 255))
        draw_line(pen, [(782, 60), (804, 27)], "#EAF6F8", 7)
        draw_line(pen, [(522, 232), (852, 31)], "#9CE608", 16)
    elif kind == "fasting":
        pen.ellipse(scale_box((540, 55, 760, 245)), fill=(225, 237, 240, 255), outline="#9CE608", width=7 * SUPER)
        pen.ellipse(scale_box((586, 94, 714, 211)), outline="#7295A4", width=5 * SUPER)
        draw_line(pen, [(796, 65), (796, 230)], "#46B8DD", 10)
        draw_line(pen, [(770, 92), (770, 45), (782, 87)], "#46B8DD", 6)
        draw_text(pen, (575, 126), "AYUNO", 24, "#0B2937")
    elif kind == "hydrate":
        # Water is emphasized; the glass gets a discreet prohibition slash.
        droplet = [(594, 42), (527, 137), (532, 188), (562, 225), (605, 232), (647, 207), (662, 168), (648, 126)]
        pen.polygon([(x * SUPER, y * SUPER) for x, y in droplet], fill="#46B8DD")
        pen.ellipse(scale_box((552, 140, 600, 191)), fill=(169, 232, 248, 190))
        pen.polygon([(742 * SUPER, 78 * SUPER), (850 * SUPER, 78 * SUPER), (829 * SUPER, 216 * SUPER), (763 * SUPER, 216 * SUPER)], fill=(229, 237, 239, 255))
        pen.polygon([(757 * SUPER, 145 * SUPER), (835 * SUPER, 145 * SUPER), (826 * SUPER, 203 * SUPER), (766 * SUPER, 203 * SUPER)], fill=(168, 80, 69, 230))
        draw_line(pen, [(718, 230), (874, 53)], "#9CE608", 16)

    # Small specular sweep creates depth but stays restrained.
    sweep_x = int((-120 + 1150 * ease((t - start) / max(0.4, end - start))) * SUPER)
    pen.polygon(
        [(sweep_x, 0), (sweep_x + 60 * SUPER, 0), (sweep_x - 30 * SUPER, height * SUPER), (sweep_x - 90 * SUPER, height * SUPER)],
        fill=(255, 255, 255, 13),
    )
    canvas = Image.alpha_composite(canvas, icon)
    canvas = canvas.resize((width, height), Image.Resampling.LANCZOS)
    canvas.putalpha(canvas.getchannel("A").point(lambda value: round(value * alpha)))
    return canvas, enter, leave


def graphic_frame(t: float) -> Image.Image:
    frame = Image.new("RGBA", (1080, 1920))
    specs = [
        (2.45, 5.94, "01", "EJERCICIO INTENSO", "exercise"),
        (6.02, 8.70, "02", "CAFÉ Y BEBIDAS", "drinks"),
        (8.78, 14.05, "03", "AYUNO", "fasting"),
        (14.13, 20.37, "04", "HIDRATACIÓN Y ALCOHOL", "hydrate"),
    ]
    for start, end, number, label, kind in specs:
        result = card(t, start, end, number, label, kind)
        if result is None:
            continue
        panel, enter, leave = result
        x = 80 + round(34 * (1 - enter) - 18 * leave)
        y = 972 + round(22 * (1 - enter) + 16 * leave)
        shadow = Image.new("RGBA", frame.size)
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle((x, y + 15, x + 920, y + 315), radius=32, fill=(0, 0, 0, 90))
        frame = Image.alpha_composite(frame, shadow.filter(ImageFilter.GaussianBlur(18)))
        frame.alpha_composite(panel, (x, y))
    return frame


def write_graphics():
    output = ROOT / "media/arecibo/muestra-tips-graphics-v1.mov"
    command = [
        FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", "1080x1920", "-r", str(FPS), "-i", "-", "-an", "-c:v", "qtrle", str(output),
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    for frame_index in range(round(BODY_DURATION * FPS)):
        encoder.stdin.write(graphic_frame(frame_index / FPS).tobytes())
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError("The graphics encoder failed")
    graphic_frame(4.1).save(ROOT / "runs/arecibo-muestra-tip-01.png")
    graphic_frame(7.5).save(ROOT / "runs/arecibo-muestra-tip-02.png")
    graphic_frame(13.4).save(ROOT / "runs/arecibo-muestra-tip-03.png")
    graphic_frame(18.3).save(ROOT / "runs/arecibo-muestra-tip-04.png")


def write_recipe():
    recipe = {
        "client_id": "cd02f509-4e1d-49f2-aee7-e59942b16ffd",
        "style": "../styles/arecibo.json",
        "voice_filter": "highpass=f=85,afftdn=nr=10:nf=-32:tn=1,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000",
        "music": {
            "source": "../media/music/arecibo-muestra-backbeat-v1.wav",
            "title": "Backbeat",
            "license": "CC0 1.0",
            "source_url": "https://raw.githubusercontent.com/0lhi/FreePD/stream/Electronic/Backbeat.mp3",
            "license_evidence": "https://github.com/0lhi/FreePD/blob/stream/LICENSE",
            "target_lufs": -29,
        },
        "outro": {
            "source": "../media/arecibo/brand/outro-sonorizado-v18.mp4",
            "in": 0,
            "out": 2.5,
            "gain": 1,
        },
        "references": {
            "approved_style_example": "media/arecibo/AreciboLab_DesdeCero_v18.mp4",
            "outro": "media/arecibo/brand/outro-sonorizado-v18.mp4",
        },
        "idea_id": "arecibo-antes-de-la-muestra",
        "catalog": "runs/arecibo-catalog.json",
        "title": "Antes De Una Toma De Muestra",
        "source": "../media/arecibo/DJI_20260909092729_0278_D.MP4",
        "transcript": "../../arecibo-lab-video/transcripts/0278.json",
        "clips": [
            {"in": 3.403, "out": 5.806, "zoom_keyframes": [{"time": 0, "zoom": 1}, {"time": 2.403, "zoom": 1.025}]},
            {"in": 6.073, "out": 9.610, "zoom_keyframes": [{"time": 0, "zoom": 1.025}, {"time": 3.537, "zoom": 1.04}]},
            {"in": 9.843, "out": 12.613, "zoom_keyframes": [{"time": 0, "zoom": 1.015}, {"time": 2.77, "zoom": 1.035}]},
            {"in": 12.913, "out": 15.783, "zoom_keyframes": [{"time": 0, "zoom": 1.025}, {"time": 2.87, "zoom": 1.04}]},
            {"in": 16.216, "out": 18.719, "zoom_keyframes": [{"time": 0, "zoom": 1.04}, {"time": 2.503, "zoom": 1.055}]},
            {"in": 46.313, "out": 52.619, "zoom_keyframes": [{"time": 0, "zoom": 1.015}, {"time": 6.306, "zoom": 1.045}]},
        ],
        "broll": [
            {
                "source": "../media/arecibo/0285-muestra-crop.mp4",
                "in": 0.25,
                "out": 2.50,
                "at": 0.08,
                "original_source": "../media/arecibo/DJI_20260909094109_0285_D.MP4",
                "source_in": 0.85,
                "source_out": 3.10,
                "reason": "Toma real y silenciosa de extracción de sangre durante el gancho sobre toma de muestra; encuadre derivado ya protege el monitor.",
                "zoom_keyframes": [{"time": 0, "zoom": 1}, {"time": 2.25, "zoom": 1.04}],
                "fade_in": 0.14,
                "fade_out": 0.18,
            },
            {
                "source": "../media/arecibo/muestra-tips-graphics-v1.mov",
                "in": 0,
                "out": BODY_DURATION,
                "at": 0,
                "kind": "brand_graphic",
                "reason": "Cuatro ilustraciones animadas, nativas a 1080x1920 y sincronizadas con consejos grabados. No añaden afirmaciones médicas.",
            },
        ],
        "transitions": [
            {"time": 2.403, "duration": 0.10},
            {"time": 5.94, "duration": 0.10},
            {"time": 11.58, "duration": 0.08},
            {"time": 14.083, "duration": 0.10},
        ],
        "effects": [],
        "sounds": [
            {"kind": "preset", "preset": "whoosh_soft", "time": 0.08, "duration": 0.28, "gain_db": -23},
            {"kind": "preset", "preset": "mouse_click", "time": 2.45, "duration": 0.09, "gain_db": -14},
            {"kind": "preset", "preset": "mouse_click", "time": 6.02, "duration": 0.09, "gain_db": -14},
            {"kind": "preset", "preset": "mouse_click", "time": 8.78, "duration": 0.09, "gain_db": -14},
            {"kind": "preset", "preset": "mouse_click", "time": 14.13, "duration": 0.09, "gain_db": -14},
        ],
        "captions": [
            {"start": 0.077, "end": 1.18, "text": "¿QUÉ NO DEBES HACER"},
            {"start": 1.18, "end": 2.337, "text": "ANTES DE UNA TOMA DE MUESTRA?"},
            {"start": 2.45, "end": 3.55, "text": "NO DEBERÍAS HACER"},
            {"start": 3.55, "end": 4.75, "text": "EJERCICIOS INTENSOS"},
            {"start": 4.75, "end": 5.87, "text": "24 HORAS ANTES"},
            {"start": 6.017, "end": 7.24, "text": "RECUERDA NO TOMAR CAFÉ"},
            {"start": 7.24, "end": 8.657, "text": "NI BEBIDAS AZUCARADAS"},
            {"start": 8.777, "end": 9.20, "text": "¿POR QUÉ?"},
            {"start": 9.20, "end": 10.50, "text": "LA MAYORÍA DE LAS PRUEBAS"},
            {"start": 10.50, "end": 11.477, "text": "QUE REALIZA EL MÉDICO"},
            {"start": 11.624, "end": 14.004, "text": "SON EN ESTADO DE AYUNAS"},
            {"start": 14.13, "end": 15.70, "text": "POR ÚLTIMO"},
            {"start": 15.70, "end": 17.10, "text": "HIDRÁTESE BIEN"},
            {"start": 18.003, "end": 20.349, "text": "Y EVITA ALCOHOL EL DÍA ANTES"},
        ],
        "review_notes": [
            "Cortes verificados por palabra y fotogramas: 3.403–5.806, 6.073–9.610, 9.843–12.613, 12.913–15.783, 16.216–18.719 y 46.313–52.619. Se excluyen cuenta regresiva, errores, indicaciones y ensayos.",
            "El cierre conserva hidrátese bien y no alcohol el día antes. No se presentan los consejos como universales fuera de la voz grabada.",
            "B-roll 0285 se usa solo durante el gancho y no se repite. Los demás puntos usan ilustraciones profesionales porque no existe B-roll real pertinente.",
            "Cuatro clicks mecánicos fuertes, uno por punto. Música Backbeat CC0, distinta a Inspiration, reducida bajo la voz.",
            "Gráficas a 1080x1920 con rasterización interna 2x. Captions Montserrat 70 fijos, outro oficial sonorizado y zooms suaves.",
            "Escucha crítica y aprobación del usuario pendientes.",
        ],
    }
    path = ROOT / "edits/arecibo-muestra-0278-v2.json"
    path.write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    write_graphics()
    write_recipe()
