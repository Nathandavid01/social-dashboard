import json,subprocess,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import audiokit,pipeline
w=Path('/Volumes/Extreme SSD/Nate Media/delian-blanqueamiento-v5')
e=json.loads((ROOT/'edits/delian-blanqueamiento-antes-20260921-v4.json').read_text())
dest=ROOT/'edits/delian-blanqueamiento-antes-20260921-v5.json'
assert not dest.exists()
body=round(sum(c['out']-c['in'] for c in e['clips']),6);tail=3.366667;total=body+tail
source=w/'Hip Hop 03 - Lily J.mp3'
assert not any('Hip Hop 03' in p.read_text() for p in (ROOT/'edits').glob('*.json'))
prov={'title':'Hip Hop 03','author':'Lily J','source':'https://mixkit.co/free-stock-music/hip-hop/','download_url':'https://assets.mixkit.co/music/739/739.mp3','license':'Mixkit Stock Music Free License','license_evidence':'https://mixkit.co/license/modal/musicFree/','sha256':audiokit.digest(source)}
source.with_suffix('.provenance.json').write_text(json.dumps(prov,indent=2))
def ff(*a):subprocess.run([pipeline.FFMPEG,'-v','error','-n',*map(str,a)],check=True)
e['audio_master']['music_below_voice_lu']=11
cfg=audiokit.settings(e);voice=json.loads((ROOT/'runs/delian-blanqueamiento-antes-20260921-v4.audio.json').read_text())['voice']
raw=w/'music-raw.wav';ff('-ss',8,'-i',source,'-t',total,'-vn','-af',f'afade=t=in:d=0.12,afade=t=out:st={total-.7}:d=0.7','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw)
level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i'];gain=voice['measurement']['input_i']-11-level
music=w/'music-continuous.wav';ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=w/'outro-click.wav';pipeline.synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}])
outro=w/'outro-music-click.mov';ff('-i',ROOT/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
image=w/'seleccion-tono.png';assert image.exists()
broll=w/'seleccion-tono-keyframes.mp4'
ff('-loop',1,'-i',image,'-vf',"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='1+0.045*on/86':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=87:s=1080x1920:fps=30,setsar=1",'-t',2.9,'-an','-c:v','libx264','-crf',18,'-preset','fast','-pix_fmt','yuv420p',broll)
e['style']='../styles/delian-reference-v6-shoika.json'
for c in e['captions']:
 c.pop('primary_colour',None)
 if c['end']<3.81:c['back_colour']='&H00000000'
for c in e['clips']:c['zoom_keyframes']=[{'time':0,'zoom':1},{'time':round(c['out']-c['in'],6),'zoom':1.025}]
e['broll']=[{'source':str(broll),'in':0,'out':2.65,'at':6.5,'fade_in':0,'fade_out':0,'reason':'Selección del tono al mencionar el color de los dientes. Fotografía editorial generada, no caso real ni resultado; sin rótulo por petición del usuario.'}]
e['effects']=[];e['graphics']=[]
e['sounds']=[{'preset':'mouse_click','time':t,'gain_db':-22} for t in [3.81,6.5,9.15]]
e['outro'].update(source=str(outro),gain=1)
e['music']={'source':str(music),'title':'Hip Hop 03 - Lily J','license':prov['license'],'provenance':str(source.with_suffix('.provenance.json')),'source_offset':8,'fade_out_scope':'End of outro'}
e['review_notes']=['Pregunta y respuesta originales completas, Shoika blanca y sombra violeta; pregunta con sombra negra.','Apoyo editorial nuevo de selección de tono, keyframes discretos, cortes opacos y clicks. Sin fundidos ni Imagen ilustrativa por petición del usuario.','Música distinta Hip Hop 03 - Lily J; licencia Mixkit guardada, continuidad hasta el cierre.','Metricool marca 6354086: no coincidencia en las 10 entradas consultadas 2026-09-01 a 2027-09-24. No se ha subido a Metricool.','Escucha crítica y aprobación pendientes.']
dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
(w/'caption.txt').write_text('¿Blanqueamiento antes o después del diseño de sonrisa? 🦷✨\n\nLa Dra. Delian Loyola te explica por qué el orden importa al seleccionar el tono para tu diseño de sonrisa. 😊\n\n¡Agenda tu evaluación y planifica tu sonrisa con nosotros!\n📞 787-230-7573\n\n#dentistapr #dentistapuertorico #diseñodesonrisa #blanqueamientodental #puertorico\n')
print(dest)
