from pathlib import Path
import json,subprocess
j=json.loads(Path('runs/clima-small.json').read_text())
for s in j['segments']:
 s['text']=s['text'].replace('añadir','dañar').replace('Montserrat','Monserrate')
 for w in s['words']: w['word']=w['word'].replace('añadir','dañar').replace('Montserrat','Monserrate')
j['text']=''.join(s['text'] for s in j['segments'])
j['correction_notes']='Dañar ajustado al brief; Monserrate según nombre de ubicación registrado en dashboard.'
Path('runs/clima-reviewed.json').write_text(json.dumps(j,indent=2,ensure_ascii=False))
e=json.loads(Path('edits/pregunta-v6.json').read_text())
e.update(title="Clima · Nana's Playhouse",idea_id='a25672bd-d8a0-4f93-8482-8ec860520c8f',source='../media/b4616322-f641-4d0d-8d41-983e6d898c91.mp4',transcript='../runs/clima-reviewed.json')
e['clips']=[{'in':a,'out':b,'zoom':1} for a,b in [(1.36,6.96),(7.1,9.74),(9.96,12.62)]]
e['broll']=[{'source':'../media/'+src+'.mp4','in':a,'out':b,'at':at,'reason':reason} for src,a,b,at,reason in [('c489cf71-c5ff-4ed5-b473-739e509dd2d2',.2,3.3,0,'Juego bajo techo: niña en caballito.'),('010c6074-b36d-4bbd-bf02-37d7a63acc17',4.3,6.8,3.1,'Diversión infantil en interior.'),('c489cf71-c5ff-4ed5-b473-739e509dd2d2',3.3,5.94,5.6,'Sonrisa y juego al presentar Nana’s como alternativa.'),('010c6074-b36d-4bbd-bf02-37d7a63acc17',.1,2.76,8.24,'Juego mientras se indica la ubicación.')]]
e['transitions']=[{'time':5.6,'duration':.17}]
e['sounds']=[{'time':t,'kind':'click','gain_db':-20} for t in [0,3.1,8.24]]+[{'time':5.6,'kind':'whoosh','gain_db':-23,'duration':.17}]
e['music']={'source':'../media/music/clima-bed.wav','title':'Happy Whistling Ukulele','license':'CC0 1.0','provenance':'media/music/Happy-Whistling-Ukulele.provenance.json','target_lufs':-29}
e['review_notes']=['Segundo reel independiente: Clima.','Voz original completa, silencios reducidos; B-roll cubre la toma original del mostrador.','Fuente y outro oficiales; música de biblioteca FreePD archivada bajo CC0.','No se ha publicado ni subido al dashboard.']
Path('edits/clima-v1.json').write_text(json.dumps(e,indent=2,ensure_ascii=False))
subprocess.run(['ffmpeg','-v','error','-i','media/music/Happy-Whistling-Ukulele.mp3','-t','10.9','-ac','2','-ar','48000','-af','loudnorm=I=-29:TP=-9:LRA=7,afade=t=in:d=0.15,afade=t=out:st=10.3:d=0.6','media/music/clima-bed.wav'],check=True)
