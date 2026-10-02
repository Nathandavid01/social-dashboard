"""Versioned reference-led polish for the September smile-design reel."""
import copy
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import audiokit
from editkit import next_free_path, write_new
from pipeline import FFMPEG, cut_words
from scripts.recut_recipe import to_timeline

base = ROOT / 'edits/delian-diseno-sonrisa-20260921-v4.json'
dest = next_free_path(base)
edit = copy.deepcopy(json.loads(base.read_text()))
work = ROOT / 'runs' / (dest.stem + '-preparation')
work.mkdir(exist_ok=False)

def clip(a, b, zoom, motion=1):
    item = {'in': a, 'out': b, 'zoom': zoom, 'focus_y': .32, 'audio_edge_fade': .012}
    if motion != 1:
        item['zoom_keyframes'] = [{'time': 0, 'zoom': 1}, {'time': round(b-a, 6), 'zoom': motion}]
    return item

edit['clips'] = [clip(2.60, 4.40, 1.06), clip(4.40, 10.90, 1.24, 1.025),
                 clip(11.13, 17.83, 1.14, 1.025), clip(17.97, 20.37, 1.42, 1.015)]
body = round(sum(c['out']-c['in'] for c in edit['clips']), 6)
tail = edit['outro']['out'] - edit['outro']['in']
def time(value):
    return to_timeline(value, edit['clips'], 'next')

# Spoken words and phrase boundaries are retained; only measured silence is removed.
phrases = [
    (2.701, 3.30, '¿Qué realmente es'),
    (3.32, 4.36, 'un diseño de sonrisa?'),
    (4.686, 5.34, 'Cuando pensamos en'),
    (5.36, 6.10, 'un diseño de sonrisa,'),
    (6.12, 7.10, 'pensamos rápidamente'),
    (7.12, 8.61, 'en hacernos los dientes,'),
    (8.70, 9.70, 'en carillas,'),
    (9.72, 10.90, 'en laminados,'),
    (11.279, 12.44, 'y va mucho más que eso.'),
    (12.46, 13.34, 'Tenemos que mirar'),
    (13.368, 14.26, 'todo el rostro,'),
    (14.28, 15.10, 'los labios,'),
    (15.12, 16.15, 'las encías,'),
    (16.18, 17.83, 'sobre todo la mordida,'),
    (18.044, 18.86, 'para entonces poder crear'),
    (18.88, 20.37, 'una sonrisa armoniosa.'),
]
edit['captions'] = []
for start, end, text in phrases:
    c = {'start': time(start), 'end': time(end), 'text': text}
    if text in ('sobre todo la mordida,', 'una sonrisa armoniosa.'):
        c['primary_colour'] = '&H00E560EB'
    edit['captions'].append(c)

# The illustration exits directly into the next sentence: no fleeting return shot.
edit['broll'][0].update(at=6.05, **{'in': 0, 'out': 2.25, 'fade_in': .10, 'fade_out': 0})
edit['broll'][0]['reason'] = 'Carillas y laminados durante su mención; ilustración generada rotulada. Regreso directo a la frase siguiente.'
edit['sounds'] = [{'preset': 'swipe', 'time': at-.08, 'duration': .16, 'gain_db': -30}
                  for at in (1.8, 6.05, 8.3, 15.0)]
edit['effects'] = [{'preset': 'blur_pass', 'time': at-.05, 'duration': .10, 'intensity': .2}
                   for at in (1.8, 6.05, 8.3)]
edit['graphics'] = []
edit['audio_master'] = {'music_below_voice_lu': 10}
edit['references']['published_reel_28_august'] = '../delian-loyola-video/media/reference/publicados-28-agosto.mp4'

words = [w for s in json.loads(Path(edit['transcript']).read_text())['segments'] for w in s['words']]
mapped = cut_words(words, edit['clips'])
cfg = audiokit.settings(edit)
_, voice_report = audiokit.prepare_voice(dest, edit, mapped, work, cfg)

def ff(*args):
    subprocess.run([FFMPEG, '-v', 'error', '-n', *map(str, args)], check=True)

# One continuous licensed music bed, split sample-accurately at the branded outro.
source_music = ROOT / 'media/music/Lovely Piano Song.mp3'
provenance = json.loads(source_music.with_suffix('.provenance.json').read_text())
assert provenance['license'] == 'CC0 1.0'
assert audiokit.digest(source_music) == provenance['sha256']
raw = work / 'continuous-music-raw.wav'
ff('-ss', 5, '-i', source_music, '-t', body+tail, '-vn', '-af',
   f'afade=t=in:d=0.12,afade=t=out:st={body+tail-1.15}:d=1.15', '-ar', 48000, '-ac', 2, '-c:a', 'pcm_s24le', raw)
level = audiokit.measure(raw, cfg, prefilter=f'atrim=end={body}')['input_i']
target = voice_report['measurement']['input_i'] - cfg['music_below_voice_lu'] - .2
gain = round(target-level, 4)
music = work / 'continuous-music.wav'
ff('-i', raw, '-af', f'volume={gain}dB', '-c:a', 'pcm_s24le', music)
outro = work / 'official-outro-continuous-music.mov'
official = (base.parent / edit['outro']['source']).resolve()
ff('-i', official, '-i', music, '-filter_complex',
   f'[1:a]atrim=start={body}:end={body+tail},asetpts=PTS-STARTPTS[tail]',
   '-map', '0:v:0', '-map', '[tail]', '-t', tail, '-c:v', 'copy', '-c:a', 'pcm_s24le', outro)
edit['music'].update(source=str(music), fade_out=1.15,
                     fade_out_scope='End of official outro; continuous music across the join')
edit['outro'].update(source=str(outro), gain=1)
edit['review_notes'].append('Reference-led v5: phrase-aligned framing, measured silence trims, readable complete thoughts, direct illustration exit, restrained transitions. Original branded outro imagery preserved with continuous licensed music and final fade. Shoika unavailable: existing Montserrat remains provisional. Listening and approval pending.')
write_new(dest, edit)
plan = {'edit': str(dest), 'output': str(ROOT/'runs'/(dest.stem+'.mp4')), 'body_seconds': body,
        'previous': base.name, 'published_references': edit['references'],
        'font_exception': 'Montserrat Bold provisional; Shoika file unavailable',
        'shot_plan': [{'start': 0, 'end': 1.8, 'purpose': 'Pregunta original y contexto de clínica'},
                      {'start': 1.8, 'end': 6.05, 'purpose': 'Respuesta en plano cercano'},
                      {'start': 6.05, 'end': 8.3, 'purpose': 'Carillas y laminados: ilustración ya identificada'},
                      {'start': 8.3, 'end': 15.0, 'purpose': 'Rostro, labios, encías y mordida: gestos visibles'},
                      {'start': 15.0, 'end': body, 'purpose': 'Conclusión en primer plano'},
                      {'start': body, 'end': body+tail, 'purpose': 'Cierre oficial y salida musical'}],
        'music_gain_db': gain, 'music_target_lufs_before_master': target,
        'source_music_sha256': provenance['sha256'], 'original_outro': str(official),
        'original_outro_sha256': audiokit.digest(official),
        'critical_listening': 'pending', 'user_approval': 'pending', 'publication': 'not_requested'}
audiokit.save(work/'plan.json', plan)
print(json.dumps(plan, ensure_ascii=False, indent=2))
