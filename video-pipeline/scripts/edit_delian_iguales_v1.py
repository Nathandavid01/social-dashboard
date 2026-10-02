from pathlib import Path
import json,sys,subprocess,shutil,math,hashlib
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R));import pipeline,audiokit
D=Path('/Volumes/Extreme SSD/Nate Media/delian-iguales-v1')
source=Path('/Volumes/Extreme SSD/Nate Media/delian-loyola-video/source-2026-09-21/dji_mimo_20260921_160544_20260921160529_1790125103709_video.mp4')
dest=R/'edits/delian-sonrisas-iguales-20260921-v1.json'
assert not dest.exists()
def ff(*args):subprocess.run([pipeline.FFMPEG,'-v','error','-n',*map(str,args)],check=True)
manifest=json.loads((R/'edits/delian-iguales-v1-assets.json').read_text())
for a in manifest['assets']:
    im=D/(a['name']+'.png');shutil.copyfile(a['generated_path'],im);a['path']=str(im)
    dur=1.9 if a['name']=='rostros' else 3.04;frames=math.ceil(dur*30)
    e=f'(3*pow(on/{frames-1},2)-2*pow(on/{frames-1},3))'
    z=f'1.025-0.025*{e}' if a['name']=='rostros' else f'1.0+0.025*{e}'
    vf=f"scale=2160:3840,zoompan=z='{z}':x='iw/2-iw/zoom/2':y='(ih-ih/zoom)*0.32':d={frames}:s=1080x1920:fps=30"
    if a['name']=='rasgos':
        font=R/'media/delian/brand/Shoika-SemiBold.otf'
        # Small callouts follow the spoken order; all stay above subtitles.
        for txt,t,x,y,bx,by,bw in [('LABIOS',1.02,65,757,210,792,294),('MENTÓN',1.72,818,925,618,946,185),('NARIZ',2.36,835,656,665,691,155)]:
            vf+=f",drawbox=x={bx}:y={by}:w={bw}:h=2:color=0xd4a5e5@0.8:t=fill:enable='gte(t,{t})'"
            vf+=f",drawtext=fontfile='{font}':text='{txt}':fontsize=33:fontcolor=white:x={x}:y={y}:alpha='clip((t-{t})/0.12,0,1)'"
    ff('-i',im,'-vf',vf+',format=yuv420p','-frames:v',frames,'-c:v','libx264','-preset','fast','-crf',17,'-an',D/(a['name']+'.mp4'))
    a['video']=str(D/(a['name']+'.mp4'));a['sha256']=hashlib.sha256(im.read_bytes()).hexdigest()
    print('Animated',a['name'],flush=True)
(D/'asset-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
clips=[{'in':0,'out':2.62,'zoom':1,'focus_y':.25,'audio_edge_fade':.008,'zoom_keyframes':[{'time':0,'zoom':1},{'time':2.62,'zoom':1.025}]},{'in':2.62,'out':13.08,'zoom':1.015,'focus_y':.25,'audio_edge_fade':.008,'zoom_keyframes':[{'time':0,'zoom':1.015},{'time':10.46,'zoom':1.05}]}]
phrases=[(0,.68,'Oye, doctora,'),(.74,1.8,'¿y todos los diseños de sonrisa'),(1.8,2.36,'se ven igual?'),(2.78,4.58,'No deberían verse iguales.'),(4.82,5.84,'Cada individuo, ¿verdad?'),(5.96,7.0,'Tiene sus rasgos:'),(7.1,7.64,'labios,'),(7.8,8.32,'mentón,'),(8.44,8.98,'la nariz.'),(9.2,10.26,'Debemos llevarnos más o menos'),(10.26,10.84,'al mismo nivel'),(10.84,11.86,'para que sea acorde'),(11.86,12.68,'a cada persona.')]
caps=[{'start':a,'end':b,'text':t,**({'back_colour':'&H00000000'} if b<2.7 else {})} for a,b,t in phrases]
e={'idea_id':'sonrisas-iguales-20260921','title':'¿Todos Los Diseños De Sonrisa Se Ven Iguales?','source':str(source),'transcript':str(D/'transcript-turbo.json'),'style':'../styles/delian-reference-v6-shoika.json','clips':clips,'captions':caps,'broll':[{'source':str(D/'rostros.mp4'),'in':0,'out':1.9,'at':.72,'fade_in':0,'fade_out':0,'eof_action':'repeat','reason':'Dos rostros distintos durante pregunta; no antes/después ni resultado clínico. Ilustración original exclusiva.','provenance':str(D/'asset-provenance.json'),'asset_family':'iguales-v1-rostros'},{'source':str(D/'rasgos.mp4'),'in':0,'out':3.04,'at':6.08,'fade_in':0,'fade_out':0,'eof_action':'repeat','reason':'Rasgos de rostro conceptual con callouts labios, mentón y nariz sincronizados; preserva gestos de la doctora antes y después.','provenance':str(D/'asset-provenance.json'),'asset_family':'iguales-v1-rasgos'}],'graphics':[],'effects':[{'preset':'punch_zoom','time':.57,'duration':.3,'intensity':.45},{'preset':'punch_zoom','time':5.93,'duration':.3,'intensity':.45}],'audio_master':{'music_below_voice_lu':11},'references':{'published_reel':'../delian-loyola-video/media/reference/publicados-14-agosto.mp4','official_outro':'media/delian/brand/outro-loyola.mp4','font_reference':'media/delian/brand/tipografia.jpg'},'catalog':'runs/delian-sept-catalog.json','sounds':[{'preset':'mouse_click','time':t,'gain_db':-23} for t in [.72,2.62,6.08,9.12]],'review_notes':['Pregunta y respuesta completas del crudo 160544, sin inventar cierre. Recorte solo al final tras la frase completa.','Dos imágenes nuevas estilo 3D generadas para este reel, animadas con keyframes y callouts; sin reutilizar B-roll de otros reels. No representan pacientes ni resultados reales.','ASR small y turbo cotejadas; normalizadas doctora, rasgos y sea acorde. Escucha crítica pendiente.','53 entradas de scheduler y 23 reels de Instagram consultados, sin coincidencia de esta pregunta/respuesta; rango documentado en metricool-review.json. No se sube a Metricool.']}
body=13.08;tail=3.366667;total=body+tail
cfg=audiokit.settings(e);words=[w for s in json.loads((D/'transcript-turbo.json').read_text())['segments'] for w in s['words']];prep=D/'voice-preparation';prep.mkdir(exist_ok=True)
voicefile,voice=audiokit.prepare_voice(dest,e,pipeline.cut_words(words,clips),prep,cfg)
track=D/'Try Me - Arulo.mp3';prov=json.loads(track.with_suffix('.provenance.json').read_text());reg=json.loads((R/'styles/music-usage.json').read_text());assert 'Try Me - Arulo' not in reg['tracks']
raw=D/'music-raw.wav';ff('-ss',8,'-i',track,'-t',total,'-vn','-af',f'afade=t=in:d=0.1,afade=t=out:st={total-.65}:d=0.65','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw)
level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i'];gain=voice['measurement']['input_i']-11-level
music=D/'music-continuous.wav';ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=D/'outro-click.wav';pipeline.synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}]);outro=D/'outro-music-click.mov'
ff('-i',R/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
e['outro']={'source':str(outro),'in':0,'out':tail,'gain':1};e['music']={'source':str(music),'title':'Try Me - Arulo','license':prov['license'],'provenance':str(track.with_suffix('.provenance.json')),'source_offset':8}
dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
reg['tracks']['Try Me - Arulo']={'title':'Try Me - Arulo','source':str(track),'provenance':str(track.with_suffix('.provenance.json')),'sha256':prov['sha256'],'reserved_idea':e['idea_id'],'recipes':[str(dest.relative_to(R))]};(R/'styles/music-usage.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n')
(D/'caption.txt').write_text('¿Todos los diseños de sonrisa deberían verse iguales? 🦷✨\n\nCada rostro tiene sus propios rasgos. La Dra. Delian Loyola explica por qué los labios, el mentón y la nariz forman parte de la evaluación para diseñar una sonrisa acorde a cada persona. 💜\n\n¡Agenda tu evaluación en DML Cosmetic Dentistry!\n📞 787-230-7573\n\n#dentistapr #dentistapuertorico #diseñodesonrisa #sonrisapersonalizada #puertorico\n')
print('Recipe ready',body,total,flush=True)
