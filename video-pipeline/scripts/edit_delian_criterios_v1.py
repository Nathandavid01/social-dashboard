from pathlib import Path
import json,sys,subprocess,shutil,math,hashlib,copy
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R));import pipeline,audiokit
D=Path('/Volumes/Extreme SSD/Nate Media/delian-criterios-v1');SRC=Path('/Volumes/Extreme SSD/Nate Media/delian-loyola-video/source-2026-09-21');dest=R/'edits/delian-criterios-sonrisa-20260921-v1.json';assert not dest.exists()
def ff(*args):
 if Path(args[-1]).exists():return
 subprocess.run([pipeline.FFMPEG,'-v','error','-n',*map(str,args)],check=True)
tags=['162506','162620','162700','163136'];sources=[next(SRC.glob('*_'+t+'_*')) for t in tags]
concat=D/'sources-concat.txt';concat.write_text(''.join("file '"+str(p)+"'\n" for p in sources));source=D/'sources-combined.mp4';ff('-f','concat','-safe',0,'-i',concat,'-c','copy',source)
clips=[];segs=[];offset=0;timeline=0;usage=[]
ranges=[(11.86,16.62),(15.0,22.6),(1.4,8.47),(1.65,11.84)]
for tag,p,(a,b) in zip(tags,sources,ranges):
 j=json.loads((D/(tag+'-snapped.json')).read_text())
 # Tighten a stretched opening word to measured speech after countdown; keep raw transcript unchanged.
 if tag=='162506':
  for s in j['segments']:
   for w in s['words']:
    if w['word'].strip()=='Estas' and w['start']>10:w['start']=11.93
 for s in j['segments']:
  s=copy.deepcopy(s);s['start']+=offset;s['end']+=offset
  for w in s['words']:w['start']+=offset;w['end']+=offset
  segs.append(s)
 clips.append({'in':round(offset+a,6),'out':round(offset+b,6),'zoom':1.02 if tag=='162506' else 1.0,'focus_y':.25,'audio_edge_fade':.008,'zoom_keyframes':[{'time':0,'zoom':1.02 if tag=='162506' else 1.0},{'time':round(b-a,6),'zoom':1.07 if tag=='162506' else 1.045}]})
 usage.append({'tag':tag,'source':str(p),'source_range':[a,b],'timeline_range':[round(timeline,3),round(timeline+b-a,3)]});timeline+=b-a;offset+=float(pipeline.probe(p)['format']['duration'])
trans=D/'transcript-combined.json';trans.write_text(json.dumps({'segments':segs,'note':'Sources concatenated in listed order; exact selection and timeline mapped in source-usage.json. ASR drafts; critical listening pending.'},ensure_ascii=False,indent=2));(D/'source-usage.json').write_text(json.dumps(usage,ensure_ascii=False,indent=2))
# Faithful short caption phrases, original source times; obvious ASR spelling normalized.
phrases=[[(11.93,12.98,'Estas son las tres cosas'),(12.98,14.16,'que evalúo al momento de hacer'),(14.16,15.12,'un diseño de sonrisa'),(15.12,16.40,'en orden de importancia.')],[(15.06,15.80,'Número uno:'),(16,16.66,'la mordida.'),(16.74,17.90,'Lo más importante.'),(18.04,18.46,'¿Por qué?'),(18.62,19.42,'Porque si tenemos una'),(19.42,20.52,'mordida muy profunda,'),(20.68,21.68,'podemos tumbar entonces'),(21.68,22.4,'los laminados.')],[(1.46,2.2,'Número dos:'),(2.527,3.9,'la posición de los dientes.'),(4.08,5.12,'Bien importante si tenemos'),(5.12,6.2,'un apiñamiento en ellos,'),(6.2,7.3,'porque no queremos'),(7.3,8.32,'desgastar los dientes.')],[(1.7,2.44,'Y tercero:'),(2.6,3.54,'buscamos una armonización'),(3.54,4,'facial,'),(4.16,4.96,'que su diente se vea'),(4.96,6.04,'lo más natural posible.'),(6.24,7.06,'Si estás en busca de un'),(7.06,7.9,'diseño de sonrisa,'),(8.02,9.06,'se puede comunicar al'),(9.06,11.56,'787-230-7573')]]
caps=[]
for items,u in zip(phrases,usage):
 for a,b,t in items:
  delta=u['timeline_range'][0]-u['source_range'][0];caps.append({'start':round(a+delta,3),'end':round(b+delta,3),'text':t})
assets=[('planificacion','exec-0e77b630-9abb-4997-bc9a-7bc9482b4df0.png',.8,2.2,'Planificación dental durante introducción.'),('mordida','exec-63c2e4d7-a12b-447c-99cd-95515b55a685.png',5.68,2.42,'Modelo genérico de mordida durante nombre del criterio; no rotulado como mordida profunda.'),('posicion','exec-88407067-c374-4805-8702-a739374ae85e.png',14.9,3.9,'Apiñamiento y posición dental, ilustración conceptual.'),('armonia','exec-39a8ab46-53b4-41a1-bfe2-b2c48cf291d8.png',20.58,3.0,'Rostro y sonrisa durante armonización facial; persona ficticia, no resultado clínico.')]
broll=[];prov=[]
for name,gen,at,dur,reason in assets:
 origin=Path('/Users/ericperez/.codex/generated_images/01a0d0d0-e473-7ad3-81c4-dd92ddf421ed')/gen;im=D/(name+'.png');shutil.copyfile(origin,im);frames=math.ceil(dur*30);ease=f'(3*pow(on/{frames-1},2)-2*pow(on/{frames-1},3))';zoom=f'1.0+0.045*{ease}'
 vf=f"scale=2160:3840,zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='(ih-ih/zoom)*0.32':d={frames}:s=1080x1920:fps=30,format=yuv420p"
 video=D/(name+'.mp4');ff('-i',im,'-vf',vf,'-frames:v',frames,'-c:v','libx264','-preset','fast','-crf',17,'-an',video)
 broll.append({'source':str(video),'in':0,'out':dur,'at':at,'fade_in':0,'fade_out':0,'eof_action':'repeat','reason':reason,'provenance':str(D/'asset-provenance.json'),'asset_family':'criterios-v1-'+name})
 prov.append({'name':name,'generated_path':str(origin),'path':str(im),'video':str(video),'sha256':hashlib.sha256(im.read_bytes()).hexdigest(),'type':'ai_generated_conceptual','reserved_for':'criterios-sonrisa-20260921','note':reason})
(D/'asset-provenance.json').write_text(json.dumps({'assets':prov,'note':'Imágenes originales generadas exclusivamente; no pacientes ni casos ni resultados reales. Sin etiqueta sobre pantalla por instrucción del usuario.'},ensure_ascii=False,indent=2))
e={'idea_id':'criterios-sonrisa-20260921','title':'Tres Cosas Que Evalúo Para Un Diseño De Sonrisa','source':str(source),'transcript':str(trans),'style':'../styles/delian-reference-v6-shoika.json','clips':clips,'captions':caps,'broll':broll,'graphics':[],'effects':[{'preset':'punch_zoom','time':t,'duration':.3,'intensity':.4} for t in [4.61,12.21,19.28]],'audio_master':{'music_below_voice_lu':11},'references':{'published_reel':'../delian-loyola-video/media/reference/publicados-14-agosto.mp4','official_outro':'media/delian/brand/outro-loyola.mp4','font_reference':'media/delian/brand/tipografia.jpg'},'catalog':'runs/delian-sept-catalog.json','sounds':[{'preset':'mouse_click','time':t,'gain_db':-23} for t in [.8,3,4.76,5.68,8.1,12.36,14.9,18.8,19.43,20.58,23.58]],'review_notes':['Cuatro crudos de la misma idea: introducción válida, mordida válida, posición y armonización/cierre. Conteos e intentos fallidos fuera.','Cuatro apoyos nuevos exclusivos, sin reutilización; keyframes, cortes opacos y clicks.','Caption normaliza evalúo, apiñamiento y que su diente se vea de ASR small/turbo. Escucha crítica pendiente.','Metricool: 53 entradas y 23 reels consultados; no coincidencia en rangos documentados. No subido ni programado por esta edición.']}
# Split close at CTA, continuous source audio.
last=e['clips'].pop();split=last['in']+(6.10-1.65)
a=copy.deepcopy(last);a['out']=split;a['zoom_keyframes']=[{'time':0,'zoom':1},{'time':round(split-a['in'],6),'zoom':1.04}]
b=copy.deepcopy(last);b['in']=split;b['zoom']=1.10;b['zoom_keyframes']=[{'time':0,'zoom':1.10},{'time':round(b['out']-split,6),'zoom':1.13}];e['clips'] += [a,b]
body=sum(c['out']-c['in'] for c in e['clips']);tail=3.366667;total=body+tail;cfg=audiokit.settings(e);words=[w for s in segs for w in s['words']];prep=D/'voice-preparation';prep.mkdir(exist_ok=True);voicefile,voice=audiokit.prepare_voice(dest,e,pipeline.cut_words(words,e['clips']),prep,cfg)
track=D/'Trap Hamza - Arulo.mp3';pr=json.loads(track.with_suffix('.provenance.json').read_text());reg=json.loads((R/'styles/music-usage.json').read_text());assert 'Trap Hamza - Arulo' not in reg['tracks']
raw=D/'music-raw.wav';ff('-ss',8,'-i',track,'-t',total,'-vn','-af',f'afade=t=in:d=0.1,afade=t=out:st={total-.65}:d=0.65','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw);level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i'];gain=voice['measurement']['input_i']-11-level;music=D/'music-continuous.wav';ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=D/'outro-click.wav';pipeline.synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}]);outro=D/'outro-music-click.mov';ff('-i',R/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
e['outro']={'source':str(outro),'in':0,'out':tail,'gain':1};e['music']={'source':str(music),'title':'Trap Hamza - Arulo','license':pr['license'],'provenance':str(track.with_suffix('.provenance.json')),'source_offset':8};dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
reg['tracks']['Trap Hamza - Arulo']={'title':'Trap Hamza - Arulo','source':str(track),'provenance':str(track.with_suffix('.provenance.json')),'sha256':pr['sha256'],'reserved_idea':e['idea_id'],'recipes':[str(dest.relative_to(R))]};(R/'styles/music-usage.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n')
(D/'caption.txt').write_text('Tu diseño de sonrisa comienza con una evaluación personalizada. 🦷✨\n\nLa Dra. Delian Loyola explica tres aspectos que toma en cuenta: la mordida, la posición de los dientes y la armonización facial. Cada detalle cuenta al planificar una sonrisa acorde a ti. 💜\n\n¡Agenda tu evaluación en DML Cosmetic Dentistry!\n📞 787-230-7573\n\n#dentistapr #dentistapuertorico #diseñodesonrisa #saludbucal #puertorico\n')
def cp(src,dst):
 with open(src,'rb') as a,open(dst,'xb') as b:shutil.copyfileobj(a,b)
pipeline.os.link=cp
print('Render',body,total,flush=True);pipeline.render(dest,D/'delian-criterios-sonrisa-20260921-v1.mp4')
