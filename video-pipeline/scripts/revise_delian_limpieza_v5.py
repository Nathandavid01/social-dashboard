import json,subprocess,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import audiokit,pipeline
w=Path('/Volumes/Extreme SSD/Nate Media/delian-limpieza-v5')
e=json.loads((ROOT/'edits/delian-ultima-limpieza-20260921-v4.json').read_text())
dest=ROOT/'edits/delian-ultima-limpieza-20260921-v5.json'
assert not dest.exists()
body=round(sum(c['out']-c['in'] for c in e['clips']),6);tail=3.366667;total=body+tail
source=w/'CBPD - Arulo.mp3'
assert not any('C.B.P.D' in p.read_text() for p in (ROOT/'edits').glob('*.json'))
prov={'title':'C.B.P.D','author':'Arulo','source':'https://mixkit.co/free-stock-music/hip-hop/','download_url':'https://assets.mixkit.co/music/400/400.mp3','license':'Mixkit Stock Music Free License','license_evidence':'https://mixkit.co/license/modal/musicFree/','sha256':audiokit.digest(source)}
source.with_suffix('.provenance.json').write_text(json.dumps(prov,indent=2))
def ff(*a):subprocess.run([pipeline.FFMPEG,'-v','error','-n',*map(str,a)],check=True)
e['audio_master']['music_below_voice_lu']=11
cfg=audiokit.settings(e);voice=json.loads((ROOT/'runs/delian-ultima-limpieza-20260921-v4.audio.json').read_text())['voice']
raw=w/'music-raw.wav';ff('-ss',8,'-i',source,'-t',total,'-vn','-af',f'afade=t=in:d=0.12,afade=t=out:st={total-.7}:d=0.7','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw)
level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i'];gain=voice['measurement']['input_i']-11-level
music=w/'music-continuous.wav';ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=w/'outro-click.wav';pipeline.synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}])
outro=w/'outro-music-click.mov';ff('-i',ROOT/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
e['style']='../styles/delian-reference-v6-shoika.json'
for c in e['captions']:
 c.pop('primary_colour',None)

for c in e['clips']:c['zoom_keyframes']=[{'time':0,'zoom':1},{'time':round(c['out']-c['in'],6),'zoom':1.025}]
for b in e['broll']:b.update(fade_in=0,fade_out=0)
e['effects']=[];e['graphics']=[]
e['sounds']=[{'preset':'mouse_click','time':t,'gain_db':-22} for t in [2.61,5.61,7.64]]
e['outro'].update(source=str(outro),gain=1)
e['music']={'source':str(music),'title':'CBPD - Arulo','license':prov['license'],'provenance':str(source.with_suffix('.provenance.json')),'source_offset':8,'fade_out_scope':'End of outro'}
e['review_notes']=['Diálogo completo sin pausas de rodaje; Shoika SemiBold blanca con sombra violeta, teléfono sin punto final.','B-roll real de visita a la clínica, no se presenta como limpieza. Cortes opacos, clicks secos y keyframes suaves.','Música distinta C.B.P.D de Arulo, licencia Mixkit guardada, continua hasta outro.','Metricool marca 6354086 consultada: posts del tema son imágenes; no se encontró este reel.','Escucha crítica y aprobación pendientes.']
dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
(w/'caption.txt').write_text('¿Recuerdas cuándo fue tu última limpieza dental? 🦷✨\n\nSi tienes que pensarlo demasiado, es momento de darle un espacio a tu sonrisa en la agenda. La Dra. Delian Loyola te invita a visitarnos en DML Cosmetic Dentistry. 😊\n\n¡Llámanos y agenda tu cita hoy!\n📞 787-230-7573\n\n#dentistapr #dentistapuertorico #limpiezadental #saludbucal #puertorico\n')
print(dest)
