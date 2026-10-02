"""Recorta una receta existente con clips nuevos sin re-sincronizar captions a mano.

Captions, B-roll y sonidos de la receta base se llevan a tiempo del original
(vía los clips viejos) y se vuelven a proyectar sobre los clips nuevos. Así
partir un clip para un punch-in o quitar una pausa no desplaza los subtítulos.

Uso: python3 scripts/recut_recipe.py SPEC.json
SPEC: {"base": "edits/x-v3.json", "clips": [...],
       "caption_source_overrides": {"4": {"start": 7.10, "end": 7.90}},   # tiempos del ORIGINAL
       "caption_colours": {"8": "&H00C000C8"},
       "sounds_source": [{"preset": "mouse_click", "source_time": 7.10, ...}],  # reemplaza sounds si existe
       "graphics": [...], "effects": [...], "style": "...", "note": "..."}
"""

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from editkit import next_free_path, write_new  # noqa: E402


def to_source(t, clips):
    offset = 0
    for clip in clips:
        length = clip['out'] - clip['in']
        if t <= offset + length + 1e-6:
            return clip['in'] + (t - offset)
        offset += length
    last = clips[-1]
    return last['out']


def to_timeline(s, clips, snap):
    """snap='next' para inicios, 'prev' para finales cuando s cae en un hueco quitado."""
    offset = 0
    previous_end = None
    for clip in clips:
        length = clip['out'] - clip['in']
        if clip['in'] - 1e-6 <= s <= clip['out'] + 1e-6:
            return round(offset + min(max(s, clip['in']), clip['out']) - clip['in'], 3)
        if s < clip['in']:
            return round(offset if snap == 'next' or previous_end is None else previous_end, 3)
        offset += length
        previous_end = offset
    return round(offset, 3)


def recut(spec):
    base_path = ROOT / spec['base']
    base = json.loads(base_path.read_text())
    old, new = base['clips'], spec['clips']
    result = copy.deepcopy(base)
    result['clips'] = new
    total = sum(c['out'] - c['in'] for c in new)

    overrides = spec.get('caption_source_overrides', {})
    colours = spec.get('caption_colours', {})
    captions = []
    for i, caption in enumerate(base['captions']):
        item = dict(caption)
        src_start = to_source(caption['start'], old)
        src_end = to_source(caption['end'], old)
        o = overrides.get(str(i), {})
        src_start, src_end = o.get('start', src_start), o.get('end', src_end)
        item['start'] = to_timeline(src_start, new, 'next')
        item['end'] = min(to_timeline(src_end, new, 'prev'), round(total, 3))
        if 'text' in o:
            item['text'] = o['text']
        if str(i) in colours:
            if colours[str(i)] is None:
                item.pop('primary_colour', None)
            else:
                item['primary_colour'] = colours[str(i)]
        if item['end'] - item['start'] < .2:
            raise ValueError(f'Caption {i} quedó demasiado corto: {item}')
        captions.append(item)
    for a, b in zip(captions, captions[1:]):
        if a['end'] > b['start']:
            a['end'] = b['start']
    result['captions'] = captions

    brolls = []
    for layer in base.get('broll', []):
        item = dict(layer)
        item['at'] = to_timeline(to_source(layer['at'], old), new, 'next')
        brolls.append(item)
    result['broll'] = brolls

    if 'sounds_source' in spec:
        sounds = []
        for event in spec['sounds_source']:
            item = {k: v for k, v in event.items() if k != 'source_time'}
            item['time'] = to_timeline(event['source_time'], new, 'next')
            sounds.append(item)
        result['sounds'] = sounds
    else:
        result['sounds'] = [dict(e, time=to_timeline(to_source(e['time'], old), new, 'next'))
                            for e in base.get('sounds', [])]
    for key in ('graphics', 'effects', 'style', 'transitions'):
        if key in spec:
            result[key] = spec[key]
    result.setdefault('review_notes', []).append(spec['note'])
    dest = next_free_path(base_path)
    write_new(dest, result)
    print(dest.relative_to(ROOT), f'{total:.2f}s')
    for c in captions:
        print(f"  {c['start']:5.2f}-{c['end']:5.2f} {c['text']!r} {c.get('primary_colour', '')}")
    print('  broll', [(b['at'], b['in'], b['out']) for b in brolls])
    print('  sounds', [(s.get('preset'), s['time']) for s in result['sounds']])
    return dest


if __name__ == '__main__':
    recut(json.loads(Path(sys.argv[1]).read_text()))
