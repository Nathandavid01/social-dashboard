#!/usr/bin/env python3
"""Cut out stills and overlay transparent PNGs. Never overwrite a recipe or export."""
import argparse
import copy
import json
import subprocess
import sys
from pathlib import Path

from graphics import cutout_image, inspect_alpha, validate_graphic
from PIL import Image

ROOT = Path(__file__).resolve().parent
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'


def grab_frame(video, output, start, crop=None):
    output = Path(output)
    if output.exists():
        raise ValueError(f'Ya existe {output.name}; no se pisa')
    output.parent.mkdir(parents=True, exist_ok=True)
    filters = []
    if crop:
        x, y, w, h = crop
        filters.append(f'crop={w}:{h}:{x}:{y}')
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start), '-i', str(video),
           '-frames:v', '1', '-update', '1']
    if filters:
        cmd += ['-vf', ','.join(filters)]
    cmd.append(str(output))
    subprocess.run(cmd, check=True)
    return output


def parse_crop(text):
    parts = [int(p) for p in text.split(',')]
    if len(parts) != 4 or min(parts[2:]) <= 0:
        raise ValueError('Recorte: x,y,w,h')
    return tuple(parts)


def write_new(path, data):
    path = Path(path)
    if path.exists():
        raise ValueError(f'Ya existe {path.name}; no se pisa')
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return path


def apply_graphics(edit, items, recipe_dir=None, timeline=None):
    result = copy.deepcopy(edit)
    total = timeline or sum(c['out'] - c['in'] for c in result['clips'])
    base = Path(recipe_dir) if recipe_dir else Path('.')
    for item in items:
        graphic = dict(item)
        path = Path(graphic['source'])
        if not path.is_absolute():
            path = (base / path).resolve()
        info = inspect_alpha(path)
        graphic['_alpha'] = info
        validate_graphic(graphic, total)
        graphic.pop('_alpha', None)
        result.setdefault('graphics', []).append(graphic)
        if graphic.get('sound') == 'pop':
            result.setdefault('sounds', []).append({
                'preset': 'pop', 'time': graphic['start'], 'duration': .13, 'gain_db': -26,
                'reason': graphic.get('reason') or 'Entrada de gráfica recortada',
            })
    result.setdefault('review_notes', []).append(
        'Gráficas PNG con alfa aplicadas con Graphic Kit; nueva exportación y revisión requeridas.'
    )
    return result


def cmd_cutout(args):
    source = Path(args.image)
    dest = Path(args.output)
    if dest.exists():
        raise ValueError(f'Ya existe {dest.name}; no se pisa')
    image = Image.open(source)
    if args.crop:
        x, y, w, h = args.crop
        image = image.crop((x, y, x + w, y + h))
    cut = cutout_image(image, fuzz=args.fuzz)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cut.save(dest)
    print(json.dumps(inspect_alpha(dest), ensure_ascii=False, indent=2))


def cmd_grab(args):
    frame = grab_frame(args.video, args.output, args.start, args.crop)
    if args.cutout:
        image = Image.open(frame)
        cut = cutout_image(image, fuzz=args.fuzz)
        cut.save(frame)
    print(json.dumps(inspect_alpha(frame), ensure_ascii=False, indent=2))


def cmd_info(args):
    print(json.dumps(inspect_alpha(args.image), ensure_ascii=False, indent=2))


def cmd_apply(args):
    edit = json.loads(args.edit.read_text())
    item = {
        'source': args.image if Path(args.image).is_absolute() else str(Path(args.image)),
        'start': args.start,
        'end': args.end,
        'x': args.x,
        'y': args.y,
        'width': args.width,
        'enter': args.enter,
        'kind': 'cutout',
        'reason': args.reason or 'PNG recortado, sin fondo',
    }
    if args.pop:
        item['sound'] = 'pop'
    resolved = (args.edit.parent / item['source']).resolve() if not Path(item['source']).is_absolute() else Path(item['source'])
    if not resolved.is_file():
        raise ValueError(f'No está el PNG: {resolved}')
    # Store path relative to the recipe folder, like other assets.
    try:
        item['source'] = Path(resolved).relative_to(args.edit.parent.resolve()).as_posix()
    except ValueError:
        item['source'] = resolved.as_posix()
    result = apply_graphics(edit, [item], recipe_dir=args.edit.parent)
    write_new(args.output, result)
    print(args.output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    cmd = parser.add_subparsers(dest='cmd', required=True)
    cut = cmd.add_parser('cutout')
    cut.add_argument('image', type=Path)
    cut.add_argument('output', type=Path)
    cut.add_argument('--fuzz', type=int, default=34)
    cut.add_argument('--crop', type=parse_crop)
    grab = cmd.add_parser('grab')
    grab.add_argument('video', type=Path)
    grab.add_argument('output', type=Path)
    grab.add_argument('--ss', dest='start', type=float, required=True)
    grab.add_argument('--crop', type=parse_crop)
    grab.add_argument('--cutout', action='store_true')
    grab.add_argument('--fuzz', type=int, default=34)
    info = cmd.add_parser('info')
    info.add_argument('image', type=Path)
    apply = cmd.add_parser('apply')
    apply.add_argument('edit', type=Path)
    apply.add_argument('output', type=Path)
    apply.add_argument('--image', required=True)
    apply.add_argument('--start', type=float, required=True)
    apply.add_argument('--end', type=float, required=True)
    apply.add_argument('--x', type=float, default=90)
    apply.add_argument('--y', type=float, default=1180)
    apply.add_argument('--width', type=float, default=280)
    apply.add_argument('--enter', type=float, default=.18)
    apply.add_argument('--reason')
    apply.add_argument('--pop', action='store_true')
    args = parser.parse_args()
    try:
        {'cutout': cmd_cutout, 'grab': cmd_grab, 'info': cmd_info, 'apply': cmd_apply}[args.cmd](args)
    except ValueError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
