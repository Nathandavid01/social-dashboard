#!/usr/bin/env python3
"""Rebuild the sample-preparation timeline without changing earlier versions."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'


def build():
    recipe = json.loads((ROOT / 'edits/arecibo-muestra-0278-v2.json').read_text())
    recipe['clips'][-1]['in'] = 49.25
    zooms = [(1, 1.025), (1.020, 1.035), (1.035, 1.045),
             (1.045, 1.045), (1.045, 1.045), (1.025, 1.045)]
    for clip, (start, end) in zip(recipe['clips'], zooms):
        clip['audio_edge_fade'] = .008
        clip['zoom_keyframes'] = [
            {'time': 0, 'zoom': start},
            {'time': round(clip['out'] - clip['in'], 3), 'zoom': end},
        ]
    duration = round(sum(c['out'] - c['in'] for c in recipe['clips']), 3)
    broll = recipe['broll'][0]
    broll.update({'at': 0, 'in': .25, 'out': 2.82, 'source_in': .85,
                  'source_out': 3.42, 'fade_in': 0, 'fade_out': .13,
                  'reason': 'Gancho cubierto desde el primer fotograma; salida sobre la toma estable de la doctora, sin destello del plano de preparación.'})
    broll['zoom_keyframes'] = [{'time': 0, 'zoom': 1}, {'time': 2.57, 'zoom': 1.035}]
    recipe['broll'][1].update({
        'source': '../media/arecibo/muestra-tips-graphics-v3.mov',
        'out': duration,
        'reason': 'Cuatro puntos con ilustraciones legibles, entrada y salida de todo el panel, resolución nativa y sin cubrir ojos o subtítulos.',
    })
    recipe['transitions'] = []
    recipe['sounds'] = [
        {'kind': 'preset', 'preset': 'mouse_click', 'time': t, 'duration': .09, 'gain_db': -12}
        for t in [2.45, 6.02, 8.90, 14.23]
    ]
    # Each caption maps a phrase in the source, independently of graphic timing.
    phrases = [
        (0, 3.48, 4.60, '¿QUÉ NO DEBES HACER'),
        (0, 4.60, 5.74, 'ANTES DE UNA TOMA DE MUESTRA?'),
        (1, 6.12, 7.12, 'NO DEBERÍAS DE HACER'),
        (1, 7.12, 8.42, 'EJERCICIOS INTENSOS'),
        (1, 8.42, 9.54, '24 HORAS ANTES'),
        (2, 9.92, 11.46, 'RECUERDEN NO TOMAR CAFÉ'),
        (2, 11.46, 12.56, 'NI BEBIDAS AZUCARADAS'),
        (3, 12.98, 13.32, '¿POR QUÉ?'),
        (3, 13.40, 14.52, 'PORQUE LA MAYORÍA DE LAS PRUEBAS'),
        (3, 14.52, 15.68, 'QUE LES REALIZA EL MÉDICO'),
        (4, 16.26, 18.64, 'SON EN ESTADO DE AYUNAS'),
        (5, 49.40, 50.16, 'HIDRÁTESE BIEN'),
        (5, 50.16, 51.50, 'SIN ALCOHOL'),
        (5, 51.50, 52.50, 'EL DÍA ANTES'),
    ]
    offsets = []
    offset = 0
    for clip in recipe['clips']:
        offsets.append(offset - clip['in'])
        offset += clip['out'] - clip['in']
    recipe['captions'] = [
        {'start': round(a + offsets[i], 3), 'end': round(b + offsets[i], 3), 'text': text}
        for i, a, b, text in phrases
    ]
    recipe['music']['source'] = '../media/music/arecibo-muestra-backbeat-v3.wav'
    recipe['review_notes'] = [
        'Reedición solicitada por Eric: gancho cubierto completo y cortes sin flashes; planos consecutivos de ayuno con el mismo encuadre.',
        'Cierre directo desde 49.25s: se retira la muletilla y por último y no menos importante, conservando hidratación y alcohol.',
        'Captions reconstruidos por frase con tiempos del crudo. SIN ALCOHOL resume la prohibición grabada sin atribuirle un verbo que el ASR no pudo resolver; escucha crítica pendiente.',
        'Cuatro clicks mecánicos a -12 dBFS de pico, sincronizados con entradas. Música Backbeat CC0 ajustada a la duración nueva; outro oficial ya sonorizado.',
        'B-roll clínico 0285 solo una vez, sin su audio original. No hay material literal alternativo para ejercicio, café, ayuno o hidratación en el catálogo revisado.',
        'Gráficas nativas 1080x1920 con supersampling; captions Montserrat 70px sobre verde. Aprobación del usuario pendiente.',
    ]
    output = ROOT / 'edits/arecibo-muestra-0278-v3.json'
    if output.exists():
        raise FileExistsError(output)
    output.write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + '\n')
    music = ROOT / 'media/music/arecibo-muestra-backbeat-v3.wav'
    subprocess.run([FFMPEG, '-v', 'error', '-n', '-ss', '4', '-i',
                    str(ROOT / 'media/music/Backbeat.mp3'), '-t', str(duration),
                    '-af', f'loudnorm=I=-29:TP=-8:LRA=7,afade=t=in:d=0.18,afade=t=out:st={duration-.45}:d=0.45',
                    '-ar', '48000', str(music)], check=True)
    print(json.dumps({'recipe': str(output), 'body_duration': duration}, indent=2))


if __name__ == '__main__':
    build()
