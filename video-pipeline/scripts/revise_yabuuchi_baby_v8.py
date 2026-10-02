"""Rebuild La Baby with the current client style and distinct product details."""
import json
import subprocess
from pathlib import Path

from complete_yabuuchi_selection import ROOT, assemble, part, FFMPEG


def main():
    recipe = ROOT / 'edits/yabuuchi-seleccion-la-baby-v8.json'
    if recipe.exists():
        raise FileExistsError(recipe)
    parts = [
        part('0023', .85, 8.45, purpose='Apertura y presentación originales completas'),
        part('0021', 9.7, 11.5, mute=True, purpose='Continuidad de producto; cubierta por el B-roll 6.4–10.1'),
        part('0002', 0, 5.95, purpose='Invitación y ubicación completas; comienzo de cámara cubierto hasta 10.1'),
        part('0021', 13.4, 15.8, mute=True, purpose='Cierre de producto con recorrido a los rolls, sin repetir el rango anterior'),
    ]
    source, transcript, duration, timeline = assemble('la-baby', parts, version=8)
    edit = json.loads((ROOT / 'edits/yabuuchi-seleccion-la-baby-v7.json').read_text())
    edit.update(
        source='../' + str(source.relative_to(ROOT)),
        transcript='../' + str(transcript.relative_to(ROOT)),
        style='../styles/yabuuchi-reference-v6.json',
        clips=[{'in': 0, 'out': duration, 'zoom': 1, 'audio_edge_fade': .015}],
        source_parts=timeline,
        voice_filter='highpass=f=75',
        audio_master={'mode': 'dialogue', 'voice_mode': 'auto', 'target_lufs': -20,
                      'speech_regions': [{'start': 0, 'end': 7.3, 'role': 'presentacion'},
                                         {'start': 9.4, 'end': 15.15, 'role': 'invitacion'}]},
    )
    edit['captions'][-1:] = [
        {'start': 12.66, 'end': 13.7, 'text': 'en Dos Palmas,'},
        {'start': 13.7, 'end': 15.1, 'text': 'en Levittown, Toa Baja.'},
    ]
    clean = json.loads((ROOT / 'runs/yabuuchi-library-clean-manifest-v1.json').read_text())
    entry = next(v for k, v in clean['items'].items() if '_0021_' in k)
    edit['broll'] = []
    for segment_index, a, b, at, reason in [
        (1, 4, 6.6, 3.8, 'Vista completa de la caja al nombrar La Baby'),
        (2, 8.5, 12.2, 6.4, 'Detalle del centro y bocados; cubre el arranque de cámara de la invitación'),
    ]:
        segment = entry['segments'][segment_index]
        start = round(a - segment['effective_source_in'], 6)
        edit['broll'].append({
            'source': '../' + segment['clip']['source'], 'in': start,
            'out': round(start + b - a, 6), 'at': at, 'eof_action': 'pass',
            'original_source': entry['original_source'], 'source_in': a, 'source_out': b,
            'reason': reason,
        })
    cuts = [(3.8, -20, 'Entrada a la caja completa'),
            (6.4, -23, 'Cambio al detalle de producto'),
            (10.1, -23, 'Regreso a la invitación con cámara estable'),
            (15.35, -20, 'Cierre con detalle de los rolls')]
    edit['sounds'] = [dict(preset='whoosh_sweep', time=round(t-.114, 3),
                           duration=.32, gain_db=gain, reason=reason) for t, gain, reason in cuts]
    edit['sounds'].append(dict(preset='whoosh_soft', time=round(duration-.2, 3),
                               duration=.2, gain_db=-22, reason='Entrada al outro de piano'))
    edit['effects'] = [dict(preset='whip_pan', time=round(t-.1, 3), duration=.2,
                            intensity=.45, reason=reason) for t, _, reason in cuts if t != 6.4]
    edit['effects_reference']['total_cues'] = 5
    edit['review_notes'] = [
        'Eric indicó que el video 09 todavía requería mejor edición; v7 no está aprobado.',
        'Se conservan las dos intervenciones completas: apertura de 0023 e invitación de 0002.',
        'Anybody Expanded Black 72 y entrada reference_soft_in del perfil vigente.',
        'Caja completa, detalle central y recorrido final: tres rangos distintos del producto real.',
        'El detalle cubre el inicio movido de 0002; la voz continúa completa debajo.',
        'Pausa final de producto de 2.4 s antes del logo; ningún plano se repite ni congela.',
        'Cinco cambios editoriales con sonido contenido; se conserva el outro profesional de piano.',
        'Audio Kit nivela presentación e invitación por separado y mide el AAC final. Escucha crítica pendiente.',
    ]
    music = ROOT / 'media/yabuuchi/la-baby-v8-music.wav'
    if not music.exists():
        subprocess.run([FFMPEG, '-v', 'error', '-n', '-i', str(ROOT / 'media/music/Be Chillin.mp3'),
                        '-t', str(duration), '-af',
                        f'loudnorm=I=-29:TP=-9:LRA=7,aresample=48000,afade=t=in:d=0.08,afade=t=out:st={duration-.45}:d=0.45',
                        '-ar', '48000', str(music)], check=True)
    edit['music']['source'] = '../' + str(music.relative_to(ROOT))
    recipe.write_text(json.dumps(edit, ensure_ascii=False, indent=2) + '\n')
    print(recipe, f'body={duration:.2f}s')


if __name__ == '__main__':
    main()
