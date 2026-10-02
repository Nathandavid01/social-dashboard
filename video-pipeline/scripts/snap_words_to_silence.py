"""Copia de una transcripción Whisper con las palabras recortadas a los silencios medidos.

Whisper suele estirar una palabra sobre la pausa previa o siguiente; entonces un corte
dentro de un silencio real parece «atravesar una palabra» y pipeline.py lo rechaza.
Aquí cada palabra que se solapa con un silencio (silencedetect) se recorta al lado
donde tiene más voz. Nunca pisa el original; registra las correcciones en la copia.

Uso: python3 scripts/snap_words_to_silence.py MEDIA.MP4 TRANSCRIPT.json SALIDA.json [--db -42 --min 0.15]
"""

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

FFMPEG = os.environ.get('FFMPEG', '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg')


def silences(media, db=-42, minimum=.15):
    out = subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-i', str(media), '-af',
                          f'silencedetect=n={db}dB:d={minimum}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', out)]
    return list(zip(starts, ends))


def snap(words, gaps):
    changes = []
    for w in words:
        for s0, s1 in gaps:
            if not (w['start'] < s1 and w['end'] > s0):
                continue
            before, after = max(0, s0 - w['start']), max(0, w['end'] - s1)
            if before == 0 and after == 0:
                continue  # silencio cubre toda la palabra: voz muy baja, no se toca
            old = (w['start'], w['end'])
            if after >= before:
                w['start'] = round(s1, 3)
            else:
                w['end'] = round(s0, 3)
            changes.append({'word': w['word'].strip(), 'from': old, 'to': (w['start'], w['end'])})
    return changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('media')
    parser.add_argument('transcript')
    parser.add_argument('output')
    parser.add_argument('--db', type=float, default=-42)
    parser.add_argument('--min', type=float, default=.15)
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        raise SystemExit(f'Ya existe {output}; no se pisa')
    data = json.loads(Path(args.transcript).read_text())
    gaps = silences(args.media, args.db, args.min)
    words = [w for s in data['segments'] for w in s.get('words', [])]
    changes = snap(words, gaps)
    data.setdefault('corrections', []).append({
        'tool': 'scripts/snap_words_to_silence.py', 'silencedetect': {'db': args.db, 'min': args.min},
        'source_transcript': str(args.transcript), 'changes': changes})
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    for c in changes:
        print(f"  {c['word']!r}: {c['from']} → {c['to']}")
    print(output, f'{len(changes)} palabras ajustadas')


if __name__ == '__main__':
    main()
