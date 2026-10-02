import json,subprocess,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import audiokit
from pipeline import FFMPEG,synth_sounds
work=Path('/Volumes/Extreme SSD/Nate Media/delian-hilo-v6');base=ROOT/'edits/delian-hilo-correcto-20260921-v5.json';dest=ROOT/'edits/delian-hilo-correcto-20260921-v6.json'
assert not dest.exists()
e=json.loads(base.read_text());body=round(sum(c['out']-c['in'] for c in e['clips']),6);tail=3.366667;total=body+tail
source=work/'Hip Hop 02 - Lily J.mp3'
assert not any('Hip Hop 02' in p.read_text() for p in (ROOT/'edits').glob('*.json'))
prov={'title':'Hip Hop 02','author':'Lily J','source':'https://mixkit.co/free-stock-music/hip-hop/','download_url':'https://assets.mixkit.co/music/738/738.mp3','license':'Mixkit Stock Music Free License','license_evidence':'https://mixkit.co/license/#musicFree','sha256':audiokit.digest(source)}
source.with_suffix('.provenance.json').write_text(json.dumps(prov,indent=2))
def ff(*a):subprocess.run([FFMPEG,'-v','error','-n',*map(str,a)],check=True)
e['audio_master']['music_below_voice_lu']=11
cfg=audiokit.settings(e);voice=json.loads((ROOT/'runs/delian-hilo-correcto-20260921-v5.audio.json').read_text())['voice']
raw=work/'music-raw.wav';ff('-ss',6,'-i',source,'-t',total,'-vn','-af',f'afade=t=in:d=0.12,afade=t=out:st={total-.7}:d=0.7','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw)
level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i'];gain=voice['measurement']['input_i']-11-level
music=work/'music-continuous.wav';ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=work/'outro-click.wav';synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}])
outro=work/'outro-music-click.mov';ff('-i',ROOT/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
e['style']='../styles/delian-reference-v6-shoika.json'
for c in e['captions']:c.pop('primary_colour',None)
for i,c in enumerate(e['clips']):c['zoom_keyframes']=[{'time':0,'zoom':1},{'time':round(c['out']-c['in'],6),'zoom':1.035 if i==0 else 1.015}]
e['broll'][0].update(fade_in=0,fade_out=0)
e['broll'].append({'source':'/Users/ericperez/Nate Media/delian-loyola-video/media/source-2026-09-21/dji_mimo_20260921_164854_20260921164838_1790125084038_video.mp4','in':4.7,'out':6.52,'at':4.68,'fade_in':0,'fade_out':0,'reason':'Plano alternativo real de las manos midiendo hilo durante la cantidad necesaria; no cubre explicación del largo del brazo.'})
e['effects']=[];e['graphics']=[]
e['sounds']=[{'preset':'mouse_click','time':t,'gain_db':-22} for t in [1.05,3.25,4.68,6.5,27.78,32.53]]
e['outro'].update(source=str(outro),gain=1)
e['music']={'source':str(music),'title':'Hip Hop 02 - Lily J','license':prov['license'],'provenance':str(source.with_suffix('.provenance.json')),'source_offset':6,'fade_out_scope':'End of outro'}
e['review_notes']=['Demostración completa conservada. Shoika SemiBold blanca, sombra violeta; captions superiores durante manos/modelo. Dos B-rolls reales y cortes opacos; sin blur/fundidos. Clicks en cambios reales y outro. Keyframes discretos para no perder manos.','Música nueva Hip Hop 02 — Lily J, no usada en otras recetas; licencia Mixkit. Continúa hasta el outro.','Metricool brand 6354086 verificado en vivo: no coincide en borradores, programados o publicaciones consultados desde septiembre. No subir a Metricool.','Render guardado en SSD externo por falta de espacio interno. Aprobación y escucha crítica pendientes.']
dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
print(dest)
