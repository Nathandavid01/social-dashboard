"""Four focused Yabuuchi edits, retaining sources and earlier versions."""
import copy
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline import cut_words

FF = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
DERIVED = ROOT / 'media/yabuuchi/derived'


def source(code):
    return next((ROOT / 'media/yabuuchi/source').glob(f'*_{code}_D.MP4'))


def build_source(slug, parts, tail):
    dest = DERIVED / f'{slug}-selection-v1.mp4'
    args = [FF, '-v', 'error', '-n']
    filters, words, offset = [], [], 0
    for i, (code, a, b) in enumerate(parts):
        args += ['-i', str(source(code))]
        filters += [f'[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[v{i}]',
                    f'[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a{i}]']
        tr = json.loads(next((ROOT / 'runs/yabuuchi-transcripts').glob(f'*_{code}_D.json')).read_text())
        mapped = cut_words([w for s in tr['segments'] for w in s['words']], [{'in': a, 'out': b}])
        words += [{**w, 'start': round(w['start'] + offset, 3), 'end': round(w['end'] + offset, 3)} for w in mapped]
        offset += b - a
    filters += [''.join(f'[v{i}][a{i}]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=1[basev][basea]',
                f'[basev]tpad=stop_mode=clone:stop_duration={tail}[v]',
                f'[basea]afade=t=out:st={offset-.02}:d=0.02,apad=pad_dur={tail}[a]']
    if not dest.exists():
        subprocess.run(args + ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]',
                              '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-threads', '4',
                              '-c:a', 'aac', '-b:a', '256k', '-t', str(offset + tail), str(dest)], check=True)
    transcript = ROOT / 'runs' / f'yabuuchi-{slug}-selection-mapped.json'
    transcript.write_text(json.dumps({'segments': [{'words': words}]}, ensure_ascii=False, indent=2))
    return dest, transcript, round(offset + tail, 3)


def broll(code, a, b, at, reason):
    return {'source': '../media/yabuuchi/source/' + source(code).name, 'in': a, 'out': b,
            'at': at, 'eof_action': 'repeat', 'reason': reason}


def caption(a, b, text):
    return {'start': a, 'end': b, 'text': text}


def save(slug, old_version, parts, tail, captions, brolls, track, notes, sounds):
    e = json.loads((ROOT / 'edits' / f'yabuuchi-{slug}-{old_version}.json').read_text())
    dest, transcript, duration = build_source(slug, parts, tail)
    music = ROOT / 'media/yabuuchi' / f'{slug}-selection-music-v1.wav'
    if not music.exists():
        subprocess.run([FF, '-v', 'error', '-n', '-i', str(ROOT / 'media/music' / (track + '.mp3')),
                        '-t', str(duration), '-af', f'loudnorm=I=-29:TP=-9:LRA=7,afade=t=in:d=0.08,afade=t=out:st={duration-.4}:d=0.4',
                        '-ar', '48000', str(music)], check=True)
    e.update(source='../media/yabuuchi/derived/' + dest.name,
             transcript='../runs/' + transcript.name,
             clips=[{'in': 0, 'out': duration, 'zoom': 1, 'audio_edge_fade': .015}],
             captions=captions, broll=brolls, sounds=sounds,
             music={'source': '../media/yabuuchi/' + music.name, 'license': 'CC0 1.0',
                    'provenance': 'media/music/' + track + '.provenance.json'},
             source_parts=[{'source': str(source(c).relative_to(ROOT)), 'in': a, 'out': b} for c, a, b in parts],
             review_notes=notes + ['Captions Arial Black 52px y cierre de video 1.2.mp4; comparación visual realizada. Escucha crítica pendiente.'])
    e['effects'] = []
    recipe = ROOT / 'edits' / f'yabuuchi-seleccion-{slug}-v1.json'
    recipe.write_text(json.dumps(e, ensure_ascii=False, indent=2))
    print('PREPARED', recipe.name, duration + 2.99, flush=True)
    return {'slug': slug, 'title': e['title'], 'recipe': str(recipe.relative_to(ROOT)),
            'file': recipe.stem + '.mp4', 'duration': round(duration + 2.99, 3),
            'broll_seconds': round(sum(x['out']-x['in'] for x in brolls), 2),
            'changes': notes, 'broll': brolls}


items = []
items.append(save('primer-sushi', 'v3', [('0985', 1.78, 10.05)], .6, [
    caption(.04, 1.84, 'Si fuera mi primera vez probando el sushi,'),
    caption(2.06, 3, '¿qué tú me recomendarías?'),
    caption(3.20, 4.78, 'Yo te diría que el Churrasco Roll.'),
    caption(4.84, 6.70, 'El que lleva churrasco, queso crema, cebollín,'),
    caption(6.80, 8.23, 'arriba amarillito y salsa anguila.')], [
    broll('0991', .3, 4.33, 4.84, 'Plano cerrado del Churrasco Roll: ingredientes visibles, sin repetir toma en los otros tres reels.')],
    'Be Chillin', ['Pregunta directa, se retira el saludo inicial y la respuesta fuera de cámara del cierre.',
                   'El producto permanece hasta el outro; se elimina el regreso breve a la presentadora.'],
    [{'preset': 'whoosh_soft', 'time': 4.84, 'duration': .18, 'gain_db': -29}]))

items.append(save('churrasco-roll', 'v4', [('0986', 1.20, 7.17), ('0986', 10.70, 15.30)], 1.6, [
    caption(.04, 1.84, 'Por aquí vamos a estar preparando'),
    caption(1.84, 3.08, 'el Churrasco Roll,'),
    caption(3.16, 5.88, 'que es buenísimo para los principiantes.'),
    caption(6.05, 7.18, 'Va a llevar queso crema,'),
    caption(7.27, 8.0, 'cebollín,'),
    caption(8.35, 10.51, 'churrasco y amarillito por encima.')], [
    broll('0986', 19.7, 20.77, 6.20, 'Queso crema al nombrarlo.'),
    broll('0986', 23.5, 24.58, 7.27, 'Cebollín al nombrarlo; montaje continuo sin flashes de presentadora.'),
    broll('0986', 29, 30.26, 8.35, 'Churrasco durante su mención.'),
    broll('0986', 55, 55.96, 9.61, 'Amarillito sobre el roll al nombrarlo.'),
    broll('0987', 9.5, 11.1, 10.57, 'Hero final del Churrasco Roll terminado, antes del cierre de marca.')],
    'Backbeat', ['Ingredientes sincronizados a las palabras y planos continuos.',
                 'Se elimina la frase final dudosa y se cierra con el roll terminado, sin conversación incidental.'],
    [{'preset': 'whoosh_soft', 'time': 6.20, 'duration': .18, 'gain_db': -30}]))

items.append(save('la-baby', 'v4', [('0023', 3.32, 8.22)], 1, [
    caption(.08, 1.36, 'Aquí en Yabuuchi Levittown'),
    caption(1.46, 3.16, 'tenemos la cajita de La Baby,'),
    caption(3.38, 4.84, 'que es perfecto para dos personas.')], [
    broll('0021', 4, 8.44, 1.46, 'Caja real La Baby al nombrarla, seguida de la mención de dos personas y cierre de producto.')],
    'Be Chillin', ['Se retira la apertura de transcripción dudosa; comienza con ubicación y producto.',
                   'Caption conserva perfecto como está transcrito; no sustituye el audio por una corrección gramatical.',
                   'El B-roll de la caja completa llega hasta el outro, sin retorno fugaz a la presentadora.'],
    [{'preset': 'whoosh_soft', 'time': 1.46, 'duration': .18, 'gain_db': -29}]))

items.append(save('quiero-dos', 'v4', [('0006', .7, 7.4)], 0, [
    caption(.06, 2.02, 'Tenemos que aprender a decir que no.'),
    caption(2.18, 3.60, 'Si la mesera viene y dice:'),
    caption(4.16, 5.12, '¿Quieres un rollo?'),
    caption(5.46, 5.92, 'No.'),
    caption(5.94, 6.58, '¡Quiero dos!')], [
    broll('0990', 1.2, 2.58, 3.96, 'Plano exterior de un roll durante la pregunta; regresa a tiempo para el gesto y el remate.')],
    'Downtown Boogie', ['Se añade B-roll pertinente durante la pregunta, de una toma distinta al primer sushi.',
                       'El remate aparece en dos captions sincronizados: No / Quiero dos; rostro y gesto visibles.'],
    [{'preset': 'whoosh_soft', 'time': 3.96, 'duration': .16, 'gain_db': -30},
     {'preset': 'pop', 'time': 5.94, 'duration': .13, 'gain_db': -28}]))

(ROOT / 'runs/yabuuchi-selection-manifest.json').write_text(json.dumps({
    'requested_count': 4, 'status': 'prepared', 'reference': 'media/yabuuchi/brand/primary-edit-reference.mp4',
    'items': items, 'audio_listening': 'unavailable_in_session'}, ensure_ascii=False, indent=2))
