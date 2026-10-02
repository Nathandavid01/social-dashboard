"""Extend the short 0281 reel with the doctor's recorded services explanation."""
import copy
import hashlib
import json
import math
import subprocess
from pathlib import Path

from pipeline import FFMPEG, cut_words

R = Path(__file__).resolve().parent
VERSION = 'v4'
BASE = R / f'media/arecibo/nuevo-lab-0281-0277-base-{VERSION}.mp4'
PARTS = [
    ('0281', 'DJI_20260909093310_0281_D.MP4', 1.78, 4.26),
    ('0277', 'DJI_20260909092343_0277_D.MP4', 7.30, 21.50),
    ('0281', 'DJI_20260909093310_0281_D.MP4', 10.28, 13.45),
]
PRE = 'aformat=channel_layouts=mono,highpass=f=85,afftdn=nr=10:nf=-32:tn=1'


def measure(path, start, end):
    proc = subprocess.run([
        FFMPEG, '-hide_banner', '-i', str(path), '-vn', '-af',
        f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,{PRE},'
        'loudnorm=I=-16:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'
    ], capture_output=True, text=True, check=True)
    return json.loads(proc.stderr[proc.stderr.rfind('{'):proc.stderr.rfind('}') + 1])


def main():
    if BASE.exists():
        raise FileExistsError(f'Preserve the previous base: {BASE}')
    args = [FFMPEG, '-v', 'error', '-n', '-filter_complex_threads', '2']
    filters, words, segments, clips = [], [], [], []
    offset = 0.0
    for index, (family, filename, start, end) in enumerate(PARTS):
        source = R / 'media/arecibo' / filename
        duration = math.ceil(round((end - start) * 30, 6)) / 30
        measured = measure(source, start, end)
        audio_norm = (
            'loudnorm=I=-16:TP=-2:LRA=7:'
            f'measured_I={measured["input_i"]}:measured_TP={measured["input_tp"]}:'
            f'measured_LRA={measured["input_lra"]}:measured_thresh={measured["input_thresh"]}:'
            f'offset={measured["target_offset"]}:linear=false'
        )
        args += ['-i', str(source)]
        filters += [
            f'[{index}:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,fps=30,'
            'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,'
            f'tpad=stop_mode=clone:stop_duration=0.05,trim=duration={duration},setsar=1[v{index}]',
            f'[{index}:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,{PRE},'
            f'{audio_norm},aresample=48000,afade=t=in:d=0.008,'
            f'afade=t=out:st={end-start-.008}:d=0.008,apad,atrim=duration={duration}[a{index}]',
        ]
        transcript = json.loads((R.parent / f'arecibo-lab-video/transcripts/{family}.json').read_text())
        part_words = cut_words([w for s in transcript['segments'] for w in s['words']], [{'in': start, 'out': end}])
        for word in part_words:
            w = copy.deepcopy(word)
            w['start'] = round(offset + w['start'], 3)
            w['end'] = round(offset + w['end'], 3)
            w['word'] = w['word'].replace('C83', '683')
            words.append(w)
        segments.append({
            'source': str(source.relative_to(R)), 'in': start, 'out': end,
            'timeline_start': round(offset, 3), 'timeline_duration': round(duration, 6),
            'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'voice_measurement': measured,
        })
        clips.append({'in': round(offset, 6), 'out': round(offset + duration, 6),
                      'zoom_keyframes': [{'time': 0, 'zoom': 1}, {'time': duration, 'zoom': 1.03}]})
        offset = round(offset + duration, 6)
    filters.append(''.join(f'[v{i}][a{i}]' for i in range(len(PARTS))) + 'concat=n=3:v=1:a=1[v][a]')
    args += ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]',
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-threads', '4',
             '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(BASE)]
    subprocess.run(args, check=True)
    transcript_path = R / f'runs/arecibo-nuevo-lab-{VERSION}-transcript.json'
    transcript_path.write_text(json.dumps({'segments': [{'words': words}], 'source_segments': segments}, ensure_ascii=False, indent=2) + '\n')
    edit = json.loads((R / 'edits/arecibo-nuevo-lab-0281-v3.json').read_text())
    edit.update(source='../media/arecibo/' + BASE.name,
                transcript='../runs/' + transcript_path.name,
                source_segments=segments, clips=clips,
                voice_filter='anull,aresample=48000',
                previous_version='../runs/arecibo-nuevo-lab-0281-v3.mp4')
    # Reception is a single uninterrupted insert. A straight cut introduces the doctor.
    edit['broll'][0].update(out=1.82, fade_out=0)
    edit['broll'][0]['zoom_keyframes'][-1]['time'] = 1.52
    location_start = segments[2]['timeline_start']
    edit['broll'][1].update(at=location_start, out=offset-location_start, fade_in=0, fade_out=0)
    # The existing photographic shot has 96 frames and covers the complete location segment.
    edit['broll'][1]['reason'] += ' Se mantiene hasta el outro, sin volver al presentador.'
    captions = copy.deepcopy(edit['captions'][:3])
    captions[-1]['end'] = 2.5
    service_captions = [
        (7.38, 8.56, 'EN ARECIBO LAB OFRECEMOS'),
        (8.56, 10.02, 'SERVICIO DE TOMA DE MUESTRA'),
        (10.02, 11.44, 'PARA LAS PRUEBAS DE CERNIMIENTO'),
        (11.44, 13.68, 'QUE EL MÉDICO LE ENVÍA'),
        (13.68, 15.76, 'EN TRES A SEIS MESES'),
        (16.12, 16.92, 'TAMBIÉN OFRECEMOS'),
        (16.92, 18.65, 'PRUEBAS DE PATERNIDAD'),
        (18.86, 19.70, 'PRUEBAS DE DOPAJE'),
        (20.10, 21.25, 'CULTIVOS'),
    ]
    for a, b, text in service_captions:
        captions.append({'start': round(a-7.3+2.5, 3), 'end': round(b-7.3+2.5, 3), 'text': text})
    for caption in edit['captions'][3:]:
        c = copy.deepcopy(caption)
        c['start'] = round(c['start']-2.48+location_start, 3)
        c['end'] = round(c['end']-2.48+location_start, 3)
        captions.append(c)
    edit['captions'] = captions
    edit['sounds'] = [
        {'kind': 'preset', 'preset': 'mouse_click', 'time': 0.98, 'duration': .09, 'gain_db': -18},
        {'kind': 'preset', 'preset': 'whoosh_soft', 'time': 2.5, 'duration': .2, 'gain_db': -26},
        *[{'kind': 'preset', 'preset': 'mouse_click', 'time': round(t-7.3+2.5, 3), 'duration': .09, 'gain_db': -19}
          for t in [16.92, 18.86, 20.10]],
        {'kind': 'preset', 'preset': 'whoosh_soft', 'time': location_start, 'duration': .2, 'gain_db': -25},
    ]
    music = R / f'media/music/arecibo-nuevo-lab-be-chillin-{VERSION}.wav'
    subprocess.run([FFMPEG, '-v', 'error', '-n', '-ss', '5', '-i', str(R/'media/music/Be Chillin.mp3'),
                    '-t', str(offset), '-af', f'aformat=channel_layouts=mono,loudnorm=I=-28.5:TP=-8:LRA=7,afade=t=in:d=0.12,afade=t=out:st={offset-.45}:d=0.45',
                    '-ar', '48000', str(music)], check=True)
    edit['music']['source'] = '../media/music/' + music.name
    edit['review_notes'] = [
        'Usuario rechaza v3 por demasiado corta. v4 amplía de 8.17 s a 22.4 s con diálogo real, sin ralentizar ni repetir escenas.',
        'Gancho 0281; explicación continua de servicios 0277; cierre de ubicación 0281; outro oficial 2.5 s.',
        'No usar la frase de servicios poco clara de 0281. Se conserva la explicación de la doctora con sus calificadores.',
        'Recepción 0276 durante presentación; foto 0296 durante ubicación. Mantener a la doctora al describir servicios porque no hay otra toma literal inédita.',
        'Voz normalizada por toma después de conversión mono; captions Montserrat 70 verdes y clicks al enumerar servicios.',
        'Música CC0 extendida durante todo el diálogo, keyframes discretos y cobertura continua hasta el outro.',
        'Revisión visual, escucha crítica y aprobación deben registrarse por separado.',
    ]
    destination = R / f'edits/arecibo-nuevo-lab-0281-{VERSION}.json'
    destination.write_text(json.dumps(edit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'recipe': str(destination), 'body_seconds': offset, 'total_seconds': offset+2.5, 'location_start': location_start}))


if __name__ == '__main__':
    main()
