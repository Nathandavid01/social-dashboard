"""Create a new Delian review version with upbeat music and dry clicks."""
import copy
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import audiokit
from editkit import next_free_path, write_new
from pipeline import FFMPEG, synth_sounds

base = ROOT / 'edits/delian-diseno-sonrisa-20260921-v6.json'
dest = next_free_path(base)
edit = copy.deepcopy(json.loads(base.read_text()))
work = ROOT / 'runs' / (dest.stem + '-preparation')
work.mkdir(exist_ok=True)
body = round(sum(c['out'] - c['in'] for c in edit['clips']), 6)
tail = edit['outro']['out'] - edit['outro']['in']
total = body + tail

def ff(*args):
    subprocess.run([FFMPEG, '-v', 'error', '-n', *map(str, args)], check=True)

source = ROOT / 'media/music/Funshine.mp3'
provenance = json.loads(source.with_suffix('.provenance.json').read_text())
assert provenance['license'] == 'CC0 1.0'
assert audiokit.digest(source) == provenance['sha256']
cfg = audiokit.settings(edit)
voice_report = json.loads((ROOT / 'runs/delian-diseno-sonrisa-20260921-v6.audio.json').read_text())['voice']
raw = work / 'upbeat-raw.wav'
ff('-i', source, '-t', total, '-vn', '-af',
   f'afade=t=in:d=0.08,afade=t=out:st={total-.8}:d=0.8',
   '-ar', 48000, '-ac', 2, '-c:a', 'pcm_s24le', raw)
level = audiokit.measure(raw, cfg, prefilter=f'atrim=end={body}')['input_i']
target = voice_report['measurement']['input_i'] - cfg['music_below_voice_lu'] - .2
gain = round(target - level, 4)
music = work / 'funshine-continuous.wav'
ff('-i', raw, '-af', f'volume={gain}dB', '-c:a', 'pcm_s24le', music)

# Peak aligned with each visual change, rather than the midpoint of the old swipes.
edit['sounds'] = [{'preset': 'mouse_click', 'time': at-.005,
                   'duration': .06, 'gain_db': -20}
                  for at in (1.8, 8.3, 12.29, 15.0)]
outro_click = work / 'outro-click.wav'
synth_sounds(outro_click, tail, [{'preset': 'mouse_click', 'time': 0,
                               'duration': .06, 'gain_db': -20}])
official = ROOT / 'media/delian/brand/outro-loyola.mp4'
outro = work / 'official-outro-funshine-click.mov'
ff('-i', official, '-i', music, '-i', outro_click, '-filter_complex',
   f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];'
   '[bed][2:a]amix=inputs=2:duration=first:normalize=0[tail]',
   '-map', '0:v:0', '-map', '[tail]', '-t', tail,
   '-c:v', 'copy', '-c:a', 'pcm_s24le', outro)
edit['music'] = {'source': str(music), 'title': provenance['title'],
                 'license': provenance['license'], 'provenance': str(source.with_suffix('.provenance.json')),
                 'source_offset': 0, 'fade_in': .08, 'fade_out': .8,
                 'fade_out_scope': 'End of official outro; continuous bed across join'}
edit['outro'].update(source=str(outro), gain=1)
edit['review_notes'].append('Eric: música anterior triste; transiciones deben ser clicks. Reemplazo completo por Funshine (catálogo Upbeat, CC0) y clicks secos de 60ms. Un solo click en entrada al outro, incorporado a su pista. Imagen, cortes, voz y captions de v6 conservados.')
write_new(dest, edit)
audiokit.save(work / 'plan.json', {
    'edit': str(dest), 'output': str(ROOT / 'runs' / (dest.stem + '.mp4')),
    'base': str(base), 'music_gain_db': gain,
    'music_below_voice_lu': cfg['music_below_voice_lu'],
    'music_source_sha256': provenance['sha256'], 'click_times': [1.8,8.3,12.29,15.0,17.4],
    'body_seconds': body, 'total_seconds': total,
    'unchanged': ['clips', 'captions', 'style', 'broll', 'effects', 'source', 'transcript'],
    'critical_listening': 'pending', 'publication': 'not_requested'})
print(dest)
