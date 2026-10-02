"""Transparent still overlays: PNG with alpha, never a full-frame cover."""
from collections import deque
from pathlib import Path
from PIL import Image


ALLOWED = {'source', 'start', 'end', 'x', 'y', 'width', 'enter', 'reason', 'kind', 'original_source', 'sound', 'entrance'}


def _finite(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != value or value in (float('inf'), float('-inf')):
        raise ValueError(f'{label} debe ser un número finito')
    return float(value)


def inspect_image(image, path=None):
    raw_mode = image.mode
    work = image.convert('RGBA') if image.mode != 'RGBA' else image
    pixels = list(work.getdata())
    total = len(pixels) or 1
    transparent = sum(1 for px in pixels if px[3] < 16)
    opaque = sum(1 for px in pixels if px[3] > 200)
    return {
        'path': None if path is None else str(path),
        'size': work.size,
        'mode': raw_mode,
        'transparent_ratio': round(transparent / total, 3),
        'opaque_ratio': round(opaque / total, 3),
        'has_alpha': raw_mode in ('RGBA', 'LA') or 'transparency' in getattr(image, 'info', {}),
    }


def inspect_alpha(path):
    with Image.open(path) as image:
        return inspect_image(image, path)


def validate_graphic(graphic, timeline, style=None):
    if not isinstance(graphic, dict):
        raise ValueError('Gráfica: propiedades desconocidas')
    incoming = {key for key in graphic if key != '_alpha'}
    if incoming - ALLOWED:
        raise ValueError('Gráfica: propiedades desconocidas')
    start = _finite(graphic.get('start'), 'start')
    end = _finite(graphic.get('end'), 'end')
    if not 0 <= start < end <= timeline + .01:
        raise ValueError('Gráfica fuera de la edición')
    x = _finite(graphic.get('x', 90), 'x')
    y = _finite(graphic.get('y', 1180), 'y')
    width = _finite(graphic.get('width', 280), 'width')
    enter = _finite(graphic.get('enter', .18), 'enter')
    if not 0 <= x <= 1000 or not 0 <= y <= 1700:
        raise ValueError('Posición de gráfica fuera del encuadre')
    if not 48 <= width <= 720:
        raise ValueError('Ancho de gráfica fuera de 48–720')
    if not 0 <= enter <= .4:
        raise ValueError('Entrada de gráfica fuera de 0–0.4s')
    entrance = graphic.get('entrance', 'slide')
    if entrance not in ('slide', 'pop'):
        raise ValueError('Entrada de gráfica desconocida')
    source = graphic.get('source')
    if not isinstance(source, str) or not source:
        raise ValueError('La gráfica necesita un PNG')
    info = graphic.get('_alpha')
    if info is None:
        return {'start': start, 'end': end, 'x': x, 'y': y, 'width': width, 'enter': enter, 'source': source, 'entrance': entrance}
    if not info.get('has_alpha') or info['transparent_ratio'] < .12:
        raise ValueError('La gráfica necesita fondo transparente (PNG con alfa)')
    if info['opaque_ratio'] < .08:
        raise ValueError('La gráfica quedó vacía al recortar el fondo')
    if style and style.get('bottom_margin'):
        height = width * (info['size'][1] / max(1, info['size'][0]))
        if entrance == 'pop' and enter > 0:
            height *= 1.06  # Includes the maximum overshoot in the caption guard.
        if y + height > 1920 - style['bottom_margin'] + 24:
            raise ValueError('La gráfica tapa la zona de captions')
    return {'start': start, 'end': end, 'x': x, 'y': y, 'width': width, 'enter': enter, 'source': source, 'entrance': entrance}


def overlay_filter(index, graphic, picture, label):
    start, end = graphic['start'], graphic['end']
    x, y, width, enter = graphic['x'], graphic['y'], graphic['width'], graphic['enter']
    if enter > 0:
        xexpr = f'if(lt(t,{start + enter}),{x}-({width}+40)*(1-(t-{start})/{enter}),{x})'
    else:
        xexpr = str(int(x))
    scale = f'[{index}:v]format=rgba,scale={int(width)}:-1[g{label}]'
    yexpr = str(int(y))
    if graphic.get('entrance') == 'pop' and enter > 0:
        # Expand around the horizontal center, overshoot gently, then settle.
        p = f'max(0,min(1,(t-{start})/{enter}))'
        factor = f'(1+2.2*pow({p}-1,3)+1.2*pow({p}-1,2))'
        scale = f"[{index}:v]format=rgba,scale=w='max(2,{width}*{factor})':h=-1:eval=frame[g{label}]"
        xexpr = f'{x}+({width}-overlay_w)/2'
        yexpr = str(int(y))  # Keep the top edge fixed; photos expand away from the face.
    over = (
        f"[{picture}][g{label}]overlay=x='{xexpr}':y='{yexpr}':format=auto:"
        f"eof_action=pass:enable='between(t,{start},{end})'[graphic{label}]"
    )
    return scale, over, f'graphic{label}'


def cutout_image(image, fuzz=34):
    work = image.convert('RGBA')
    width, height = work.size
    pixels = work.load()
    corners = [pixels[0, 0][:3], pixels[width - 1, 0][:3], pixels[0, height - 1][:3], pixels[width - 1, height - 1][:3]]

    def is_bg(color):
        return min(sum(abs(color[i] - sample[i]) for i in range(3)) for sample in corners) <= fuzz * 3

    seen = set()
    queue = deque()

    def push(x, y):
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            return
        seen.add((x, y))
        if is_bg(pixels[x, y]):
            queue.append((x, y))

    for x in range(width):
        push(x, 0)
        push(x, height - 1)
    for y in range(height):
        push(0, y)
        push(width - 1, y)
    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        push(x - 1, y)
        push(x + 1, y)
        push(x, y - 1)
        push(x, y + 1)
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            edge = any(
                0 <= x + dx < width and 0 <= y + dy < height and pixels[x + dx, y + dy][3] == 0
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
            )
            if edge:
                pixels[x, y] = (r, g, b, 165)
    box = work.getbbox()
    if not box:
        raise ValueError('No quedó contenido opaco tras recortar el fondo')
    trimmed = work.crop(box)
    info = inspect_image(trimmed)
    if info['transparent_ratio'] < .12:
        raise ValueError('No se recortó el fondo; recorta más justo o sube --fuzz')
    if info['opaque_ratio'] < .08:
        raise ValueError('El recorte dejó la imagen vacía')
    return trimmed
