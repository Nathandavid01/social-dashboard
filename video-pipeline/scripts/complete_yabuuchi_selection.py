"""Restore full ideas and apply the new piano outro without replacing prior exports."""
import copy
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline import cut_words, FFMPEG

QA = ROOT / 'runs/yabuuchi-complete-qa'
QA.mkdir(exist_ok=True)

def source(code):
    return next((ROOT / 'media/yabuuchi/source').glob(f'*_{code}_D.MP4'))

def part(code, start, end, mute=False, speed=1, purpose=''):
    return dict(code=code, start=start, end=end, mute=mute, speed=speed, purpose=purpose)

def caption(start, end, text):
    return dict(start=round(start, 3), end=round(end, 3), text=text)

def overlay(code, start, end, at, reason):
    return dict(source='../media/yabuuchi/source/' + source(code).name,
                **{'in': start, 'out': end, 'at': at, 'eof_action': 'repeat', 'reason': reason})

def assemble(slug, parts, version=4):
    dest = ROOT / f'media/yabuuchi/derived/{slug}-complete-v{version}.mp4'
    transcript = ROOT / f'runs/yabuuchi-{slug}-complete-v{version}-mapped.json'
    args = [FFMPEG, '-v', 'error', '-n', '-filter_complex_threads', '2']
    filters, words, timeline, offset = [], [], [], 0
    for i, p in enumerate(parts):
        file = source(p['code'])
        args += ['-i', str(file)]
        a, b, rate = p['start'], p['end'], p['speed']
        length = (b-a) / rate
        filters.append(f'[{i}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{rate},fps=30,scale=1080:1920,setsar=1[v{i}]')
        if p['mute']:
            filters.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={length}[a{i}]')
        else:
            assert rate == 1
            filters.append(f'[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.006,afade=t=out:st={length-.006}:d=0.006[a{i}]')
            tr = json.loads(next((ROOT/'runs/yabuuchi-transcripts').glob(f'*_{p["code"]}_D.json')).read_text())
            mapped = cut_words([w for s in tr['segments'] for w in s.get('words', [])], [{'in': a, 'out': b}])
            words += [{**w, 'start': round(w['start']+offset, 3), 'end': round(w['end']+offset, 3)} for w in mapped]
        timeline.append({**p, 'source': str(file.relative_to(ROOT)), 'at': round(offset, 3), 'duration': round(length, 3)})
        offset += length
    filters.append(''.join(f'[v{i}][a{i}]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=1[v][a]')
    if not dest.exists():
        with (QA/f'{slug}-assemble.log').open('w') as log:
            subprocess.run(args + ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]',
                '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-threads', '4', '-c:a', 'aac', '-b:a', '256k',
                '-t', str(round(offset, 3)), '-movflags', '+faststart', str(dest)], check=True, stdout=log, stderr=log)
    transcript.write_text(json.dumps({'segments': [{'words': words}]}, ensure_ascii=False, indent=2))
    return dest, transcript, round(offset, 3), timeline

def update_outro(e):
    e['outro'] = {'source': '../media/yabuuchi/brand/outro-elegant-piano-v1.mp4', 'in': 0, 'out': 2.99, 'gain': 1,
        'music_title': 'Elegant Piano Logo', 'music_author': 'Universfield', 'license': 'Pixabay Content License',
        'provenance': 'media/music/Elegant Piano Logo - Universfield.provenance.json'}
    e['references']['outro'] = 'media/yabuuchi/brand/outro-elegant-piano-v1.mp4'
    e['references']['outro_music_provenance'] = 'media/music/Elegant Piano Logo - Universfield.provenance.json'

def save(slug, parts=None, captions=None, brolls=None, notes=None, track=None):
    e = json.loads((ROOT/f'edits/yabuuchi-seleccion-{slug}-v3.json').read_text())
    update_outro(e)
    e['review_notes'] = (notes or []) + ['Captions conservados: Arial Black, tamaño ASS 72 fijo; referencia visual v4.',
        'Outro: se sustituye todo el audio anterior por Elegant Piano Logo de Universfield, con volumen moderado y caída final. Escucha crítica y aprobación del usuario pendientes.']
    if parts:
        dest, tr, duration, timeline = assemble(slug, parts)
        e.update(source='../'+str(dest.relative_to(ROOT)), transcript='../'+str(tr.relative_to(ROOT)),
                 clips=[{'in': 0, 'out': duration, 'zoom': 1, 'audio_edge_fade': .015}],
                 captions=captions, broll=brolls, source_parts=timeline, effects=[], sounds=[])
        music = ROOT/f'media/yabuuchi/{slug}-complete-v4-music.wav'
        # Quiet under speech, gently lift the bed through the silent preparation montage.
        af = f'loudnorm=I=-29:TP=-9:LRA=7,aresample=48000,afade=t=in:d=0.08,afade=t=out:st={duration-.45}:d=0.45'
        if slug == 'churrasco-roll':
            af += ",volume='1+0.65*max(0,min(1,min((t-10.57)/0.25,(15.45-t)/0.25)))+0.65*max(0,min(1,min((t-17.95)/0.25,(29.95-t)/0.25)))':eval=frame"
        if not music.exists():
            subprocess.run([FFMPEG,'-v','error','-n','-i',str(ROOT/f'media/music/{track}.mp3'),'-t',str(duration),'-af',af,'-ar','48000',str(music)], check=True)
        e['music'] = {'source': '../'+str(music.relative_to(ROOT)), 'license': 'CC0 1.0', 'provenance': f'media/music/{track}.provenance.json'}
    path = ROOT/f'edits/yabuuchi-seleccion-{slug}-v4.json'
    assert not path.exists(), path
    path.write_text(json.dumps(e, ensure_ascii=False, indent=2)+'\n')
    print(path.name, sum(c['out']-c['in'] for c in e['clips'])+2.99, flush=True)

if __name__ == '__main__':
    save('primer-sushi', notes=['Se conserva la edición v3; únicamente cambia la música del outro.'])

    churrasco_parts = [
        part('0986',1.20,7.17,purpose='Presentación completa del plato'),
        part('0986',10.70,15.30,purpose='Ingredientes con sus planos sincronizados'),
        part('0986',34.80,39.60,True,1.5,'Enrollado completo'),
        part('0986',39.65,41.75,True,1.25,'Ajuste con la esterilla'),
        part('0986',42.10,44.60,purpose='Explicación de la cubierta de amarillito'),
        part('0986',46.0,50.2,True,1.4,'Colocación y ajuste del amarillito'),
        part('0986',54.60,57.60,True,1,'Corte del roll'),
        part('0987',2.20,6.10,True,1.3,'Salsa sobre el roll terminado'),
        part('0988',5.80,10.0,True,1.4,'Sésamo y presentación final'),
        part('0989',.78,2.85,purpose='Entrega: Por aquí. Buen provecho.')]
    old=json.loads((ROOT/'edits/yabuuchi-seleccion-churrasco-roll-v3.json').read_text())
    cc=copy.deepcopy(old['captions'])
    cc += [caption(15.55,17.90,'Le ponemos el amarillito por encima.'),
           caption(30.03,30.58,'Por aquí.'),caption(30.77,31.43,'Buen provecho.')]
    br=[overlay('0986',19.70,20.77,6.20,'Queso crema al nombrarlo.'),
        overlay('0986',23.50,24.58,7.27,'Cebollín al nombrarlo.'),
        overlay('0986',29.0,31.22,8.35,'Churrasco y relleno; continuación cronológica hacia el enrollado.')]
    save('churrasco-roll',churrasco_parts,cc,br,
         ['Restaurar el proceso: ingredientes, enrollado, esterilla, amarillito, corte, salsa, sésamo y entrega real.',
          'Las tomas musicales se silencian para quitar conversación del rodaje; se conserva la explicación y Buen provecho.'], 'Backbeat')

    baby_parts=[part('0023',.85,8.45,purpose='Apertura y presentación completas de La Baby'),
                part('0021',7.8,9.6,True,purpose='Continuación del recorrido por la caja'),
                part('0002',0,5.95,purpose='Invitación completa y ubicación en Dos Palmas, Levittown, Toa Baja')]
    bc=[caption(.09,1.15,'Si tienes hambre,'),caption(1.19,2.35,'tú y tu pareja de sushi,'),
        caption(2.55,3.85,'aquí en Yabuuchi Levittown'),caption(3.93,5.65,'tenemos la cajita de La Baby,'),
        caption(5.85,7.30,'que es perfecto para dos personas.'),
        caption(9.40,11.25,'Y si aún no lo has probado,'),caption(11.34,12.66,'puedes venir aquí a Yabuuchi'),
        caption(12.66,15.08,'en Dos Palmas, en Levittown, Toa Baja.')]
    save('la-baby',baby_parts,bc,[overlay('0021',4,7.8,3.8,'Caja real durante su nombre, porción y continuación de producto.')],
         ['Se recupera íntegra la apertura registrada en 0023; no se sustituye por otro gancho.',
          'Después del recorrido por La Baby se añade la invitación grabada en 0002 y su ubicación.'], 'Be Chillin')

    qc=[caption(.16,2.10,'Tenemos que aprender a decir que no.'),caption(2.28,3.70,'Si la mesera viene y dice:'),
        caption(4.26,5.18,'¿Quieres un rollo?'),caption(5.56,5.95,'No.'),caption(6.04,6.65,'¡Quiero dos!'),caption(7.10,7.65,'Aquí está.')]
    save('quiero-dos',[part('0006',.60,9.20,purpose='Sketch íntegro: entrada, pregunta, remate, Aquí está y entrega'),
                      part('0990',2.6,4.2,True,purpose='Plano de producto después de completar la actuación')],qc,[],
         ['Se recuperan Aquí está, la entrega de la caja y la reacción final.',
          'Se deja visible la entrada y pregunta de la mesera; el B-roll se coloca después del desenlace.'], 'Downtown Boogie')
