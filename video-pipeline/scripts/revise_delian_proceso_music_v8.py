"""Reference-led revision of Proceso De Sonrisa; preserve original speech."""
import copy
import json
import subprocess
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import audiokit
from pipeline import FFMPEG, synth_sounds
from editkit import next_free_path, write_new
base = ROOT/'edits/delian-proceso-sonrisa-20260921-v7.json'
dest = next_free_path(base)
edit = copy.deepcopy(json.loads(base.read_text()))
work = ROOT/'runs'/(dest.stem+'-preparation')
work.mkdir(exist_ok=False)
def ff(*args):
    subprocess.run([FFMPEG,'-v','error','-n',*map(str,args)],check=True)
body = round(sum(c['out']-c['in'] for c in edit['clips']),6)
tail = edit['outro']['out']-edit['outro']['in']
total=body+tail

import urllib.request
track=ROOT/'media/music/City Sunshine.mp3'
assert not any('City Sunshine'.lower() in p.read_text().lower() for p in (ROOT/'edits').glob('*.json'))
u='https://raw.githubusercontent.com/0lhi/FreePD/stream/Upbeat/City%20Sunshine.mp3'
if not track.exists():track.write_bytes(urllib.request.urlopen(u).read())
track.with_suffix('.provenance.json').write_text(json.dumps({'title':'City Sunshine','source':u,'license':'CC0 1.0','license_evidence':'https://github.com/0lhi/FreePD/blob/stream/LICENSE','sha256':audiokit.digest(track)},indent=2))
source=ROOT/'media/music/City Sunshine.mp3'
prov=json.loads(source.with_suffix('.provenance.json').read_text())
assert prov['license']=='CC0 1.0' and audiokit.digest(source)==prov['sha256']
cfg=audiokit.settings(edit)
voice=json.loads((ROOT/'runs/delian-proceso-sonrisa-20260921-v7.audio.json').read_text())['voice']
raw=work/'city-sunshine-offset24-raw.wav'
ff('-ss',8,'-i',source,'-t',total,'-vn','-af',f'afade=t=in:d=0.08,afade=t=out:st={total-.8}:d=0.8','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw)
level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i']
target=voice['measurement']['input_i']-cfg['music_below_voice_lu']-.2
gain=round(target-level,4)
music=work/'city-sunshine-continuous.wav'
ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=work/'outro-click.wav';synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}])
outro=work/'official-outro-city-sunshine-click.mov'
ff('-i',ROOT/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[tail]','-map','0:v:0','-map','[tail]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
edit['outro'].update(source=str(outro),gain=1)
edit['music']={'source':str(music),'title':'City Sunshine','license':'CC0 1.0','provenance':str(source.with_suffix('.provenance.json')),'source_offset':8,'fade_in':.08,'fade_out':.8,'fade_out_scope':'End of official outro; continuous music through the join'}

edit['review_notes'].append('Eric: música distinta por reel, sin repetir canciones ni usar otro segmento como alternativa. City Sunshine no usada en recetas locales anteriores; reemplaza Funshine hasta el outro. Visuales y clicks conservados.')
write_new(dest,edit)
print(dest)
