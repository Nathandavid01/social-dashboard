import json,subprocess
from pathlib import Path
from pipeline import cut_words
root=Path(__file__).resolve().parent
j=json.loads((root/'runs/tour-transcript.json').read_text())
for s in j['segments']:
 for w in s['words']:
  if w['word'].strip()=='Montserrat':w['word']=' Monserrate'
(root/'runs/tour-reviewed.json').write_text(json.dumps(j,ensure_ascii=False,indent=2))
e=json.loads((root/'edits/clima-v6.json').read_text())
e.update(idea_id='39039f79-14c7-4330-a8f4-9b926825f1eb',title='Área De Juego · Nana’s Playhouse',source='../media/bcb362d9-9917-4d00-aec6-ec43f4f9e5a6.mp4',transcript='../runs/tour-reviewed.json')
e['clips']=[{'in':1.1,'out':3.62,'zoom':1.04},{'in':4.1,'out':13.5,'zoom':1},{'in':13.68,'out':18.25,'zoom':1.05}]
e.pop('previous_version',None)
words=cut_words([w for s in j['segments'] for w in s['words']],e['clips'])
# Phrase groups follow recorded speech and keep each card readable.
groups=[3,2,3,2,2,4,3,2,2,2,3,3,4,1,4,3,3,2,2,3,1,2,1]
# Use explicit word spans to preserve the complete spoken message.
phrases=['¿QUÉ LE ESPERA','TU NIÑO','CUANDO LLEGAN A',"NANA’S PLAYHOUSE?",'AQUÍ TENEMOS','UNA MESA DE BLOQUES','TENEMOS ÁREAS DE','SIMULACIÓN DE','SUPERMERCADO Y','COFFEE SHOP','TENEMOS UN TRAMPOLÍN','TENEMOS PISCINA','DE BOLA, CHORRERA','Y MUCHAS COSAS MÁS','ASÍ QUE LOS','ESPERAMOS AQUÍ EN',"NANA’S PLAYHOUSE",'UBICADOS EN PLAZA','MONSERRATE','EN HORMIGUEROS']
counts=[3,2,3,2,2,4,3,2,2,2,3,2,3,4,3,3,2,3,1,2]
assert sum(counts)==len(words),(sum(counts),len(words))
e['captions']=[];i=0
for text,n in zip(phrases,counts):
 block=words[i:i+n];e['captions'].append({'start':block[0]['start'],'end':block[-1]['end'],'text':text});i+=n
# Cover supermarket and trampoline with matching action; preserve the actual slide and blocks footage.
e['broll']=[]
for src,a,b,at,why,z0,z1 in [
 ('2a7a7a55-4816-4bbe-a74a-52d1e7bac0cb',.4,2.2,6.1,'Niño en supermercado al mencionarlo',1,1.08),
 ('010c6074-b36d-4bbd-bf02-37d7a63acc17',.3,1.6,7.8,'Salto al mencionar trampolín',1.07,1),
 ('c489cf71-c5ff-4ed5-b473-739e509dd2d2',2.1,3.06,10.96,'Más juegos después de mostrar piscina y chorrera',1,1.07)]:
 e['broll'].append({'source':f'../media/{src}.mp4','in':a,'out':b,'at':at,'reason':why,'zoom_keyframes':[{'time':0,'zoom':z0},{'time':round(b-a,3),'zoom':z1}]})
# Slow opening push on original footage, using the same keyframe layer mechanism.
e['broll'].insert(0,{'source':e['source'],'in':1.1,'out':3.62,'at':0,'reason':'Gancho con acercamiento suave a presentadora','zoom_keyframes':[{'time':0,'zoom':1},{'time':2.52,'zoom':1.07}]})
e['sounds']=[{'time':t,'kind':k,'gain_db':-21 if k=='whoosh' else -19,'duration':.15 if k=='whoosh' else .045} for t,k in [(0,'click'),(2.52,'whoosh'),(4.84,'click'),(6.1,'whoosh'),(7.8,'click'),(9.1,'whoosh'),(10.96,'click'),(11.92,'whoosh'),(14.06,'click')]]
e['transitions']=[{'time':t,'duration':.13} for t in [2.52,6.1,11.92]]
e['review_notes']=['Idea del dashboard: recorrido por las amenidades. Voz original; cuenta inicial y pausas retiradas.','Tomas reales de bloques y piscina/chorrera conservadas, B-roll de supermercado y trampolín sincronizado con la voz.','QUARTZO y outro existentes. Música CC0. Fuente comercial pendiente de licencia; revisión de audio y del usuario pendientes.']
e['music']['source']='../media/music/tour-bed.wav'
(root/'edits/tour-v1.json').write_text(json.dumps(e,ensure_ascii=False,indent=2))
total=sum(c['out']-c['in'] for c in e['clips'])
subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg','-v','error','-y','-i',str(root/'media/music/Happy-Whistling-Ukulele.mp3'),'-t',str(total),'-ac','2','-ar','48000','-af',f'loudnorm=I=-29:TP=-9:LRA=7,afade=t=in:d=0.15,afade=t=out:st={total-.6}:d=0.6',str(root/'media/music/tour-bed.wav')],check=True)
print('Timeline',total,'seconds')
