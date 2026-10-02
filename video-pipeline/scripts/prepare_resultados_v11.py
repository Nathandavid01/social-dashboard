import json,subprocess,copy
from pathlib import Path
R=Path('/Users/ericperez/Nate Media/video-pipeline');F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
parts=[('/Users/ericperez/Downloads/DJI_20260909091327_0271_D.LRF',1.7,5.3,R/'runs/arecibo-0271-reviewed.json'),('/Users/ericperez/Downloads/DJI_20260909091347_0272_D (1).MP4',0,13.2,R.parent/'arecibo-lab-video/transcripts/0272.json'),('/Users/ericperez/Downloads/DJI_20260909091538_0273_D.MP4',8.55,20.6,R/'runs/arecibo-0273-transcript.json')]
filters=[];args=[F,'-v','error','-y'];words=[];offset=0;provenance=[]
for i,(p,a,b,tr) in enumerate(parts):
 args+=['-i',p];filters += [f'[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[v{i}]',f'[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000[a{i}]']
 for s in json.loads(tr.read_text())['segments']:
  for w in s.get('words',[]):
   if w['start']>=a-.015 and w['end']<=b+.015 and w['end']>w['start']:
    nw=copy.deepcopy(w);nw['start']=round(w['start']-a+offset,3);nw['end']=round(w['end']-a+offset,3);words.append(nw)
 provenance.append({'source':p,'in':a,'out':b,'timeline_start':offset});offset+=b-a
filters+=[''.join(f'[v{i}][a{i}]' for i in range(3))+'concat=n=3:v=1:a=1[v][a]']
args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-threads','4','-c:a','aac','-b:a','192k',str(R/'media/arecibo/resultados-0271-0272-0273-base-v11.mp4')]
subprocess.run(args,check=True)
(R/'runs/arecibo-resultados-v11-transcript.json').write_text(json.dumps({'segments':[{'words':words}]},ensure_ascii=False,indent=2))
d=json.loads((R/'edits/arecibo-resultados-0271-v10.json').read_text());d.update(source='../media/arecibo/resultados-0271-0272-0273-base-v11.mp4',original_source='../media/arecibo/resultados-0271-0272-0273-base-v11.mp4',source_segments=provenance,transcript='../runs/arecibo-resultados-v11-transcript.json',clips=[{'in':0,'out':round(offset,3),'zoom':1}],broll=[],sounds=[],effects=[],transitions=[])
caps=[(0.14,.94,'OYE, DOCTORA'),(1.22,1.94,'¿Y CUÁNTO TARDAN'),(1.94,2.54,'LOS RESULTADOS'),(2.54,3.5,'AQUÍ EN ARECIBO LAB?')]
for a,b,t in [(0,1.78,'ESTO VA A DEPENDER'),(1.78,2.76,'DE QUÉ TIPO'),(2.76,4.3,'DE PRUEBAS EL MÉDICO LE ENVIÓ'),(4.76,5.34,'POR EJEMPLO'),(5.34,6.2,'SI LE ENVIARON A HACER'),(6.2,7.05,'UNA PRUEBA DE DOPAJE'),(8.2,9.02,'SI LE ENVIARON'),(9.02,10.34,'PRUEBA DE CERNIMIENTO'),(10.58,12,'PUES SERÍA YA BÁSICAMENTE')]:caps.append((a+3.6,b+3.6,t))
for a,b,t in [(8.72,10.22,'ASÍ QUE SI NECESITAS'),(10.22,11.4,'REALIZARTE ALGUNA PRUEBA'),(11.4,12.22,'DE LABORATORIO'),(12.38,13.5,'PUEDEN LLAMARNOS AL'),(13.5,16.3,'787-817-2270'),(16.52,17.4,'ESTAMOS UBICADOS'),(17.4,18.9,'EN EL BARRIO FACTOR'),(18.9,20.6,'FRENTE A HQJ')]:caps.append((a+8.25,b+8.25,t))
d['captions']=[{'start':round(a,3),'end':round(b,3),'text':t} for a,b,t in caps]
for number,at,dur,unit,sourcein in [(15,10.65,1.1,'min',7.05),(24,15.6,1.2,'h',12.)]:
 c=json.loads((R/'motion/arecibo-clock.json').read_text());c.update(source=parts[1][0],source_in=sourcein,source_speed=1,duration=dur,values=[number,number],change_at=.4,unit=unit,center=[540,1390],radius=230,entry_duration=.2,exit_duration=.2,tick_gain_db=-22)
 conf=R/f'motion/arecibo-results-v11-{number}.json';conf.write_text(json.dumps(c,indent=2));out=R/f'media/arecibo/results-v11-clock-{number}.mp4';subprocess.run(['python3','motionkit.py',str(conf),str(out)],cwd=R,check=True)
 d['broll'].append({'source':'../media/arecibo/'+out.name,'in':0,'out':dur,'at':at,'kind':'brand_graphic','reason':f'Reloj {number} {unit} sobre la misma toma y tiempo original; no es B-roll ni otra respuesta.'})
 cue=json.loads(out.with_suffix('.motion.json').read_text())['sound_events']
 for e in cue:e['time']=round(e['time']+at,3);d['sounds'].append(e)
d['broll'].append({'source':'../media/arecibo/DJI_20260909100150_0298_D.MP4','in':1,'out':5.08,'at':24.77,'reason':'Fachada única al describir ubicación, continua hasta outro.'})
d['sounds'].append({'kind':'preset','preset':'whoosh_soft','time':24.77,'duration':.18,'gain_db':-25})
d['music']['source']='../media/music/resultados-bed-v11.wav';d['previous_version']='../runs/arecibo-resultados-0271-v10.mp4';d['review_notes']=['Pedido del usuario: 0271 solo pregunta (1.70–5.30), respuesta 0272 (0–13.20), cierre 0273 (8.55–20.60).','Relojes 15 min y 24 h ilustran la respuesta nueva. Se elimina rango 15–30 de la respuesta anterior.','0271 es proxy 720p; respuestas originales a mayor resolución.','Sin escucha crítica ni aprobación final; revisión visual y técnica por separado.']
(R/'edits/arecibo-resultados-0271-v11.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
subprocess.run([F,'-v','error','-y','-i',str(R/'media/music/Inspiration.mp3'),'-t',str(offset),'-af',f'loudnorm=I=-28:TP=-5:LRA=7,afade=t=out:st={offset-.5}:d=0.5','-ar','48000',str(R/'media/music/resultados-bed-v11.wav')],check=True)
