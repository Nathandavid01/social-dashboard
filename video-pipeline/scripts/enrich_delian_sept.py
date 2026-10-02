import json,shutil,subprocess,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from editkit import next_free_path
D=R/'runs/delian-sept-enriched';D.mkdir(exist_ok=True)
A=R/'media/delian/broll-sept-enriched';A.mkdir(exist_ok=True)
G=Path('/Users/ericperez/.codex/generated_images/01a0cf0a-1bb6-7bf1-ac88-083573e005b7')
assets={'carillas':'exec-63fa2bdd-67ec-451e-b5ba-cdb325b6b328.png','encerado':'exec-04681c2d-8ac9-46f7-b355-829d7cedaa92.png','color':'exec-c3200828-26c1-4411-8344-a24520bb03e9.png'}
for name,filename in assets.items():
 img=A/(name+'.png');shutil.copy2(G/filename,img)
 vid=A/(name+'-animated.mp4')
 if not vid.exists():
  vf="scale=1620:2880,zoompan=z='1+0.045*on/89':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=90:s=1080x1920:fps=30,drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='IMAGEN ILUSTRATIVA':fontsize=28:fontcolor=0x49314f:x=(w-tw)/2:y=340,format=yuv420p"
  subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg','-v','error','-loop','1','-i',str(img),'-vf',vf,'-t','3','-an','-c:v','libx264','-preset','fast','-crf','18','-threads','4',str(vid)],check=True)
plan=[]
for item in json.loads((R/'runs/delian-sept-five.json').read_text())['videos']:
 old=R/'edits'/Path(item['video']).with_suffix('.json');e=json.loads(old.read_text());slug=e['idea_id'].removesuffix('-20260921');total=sum(c['out']-c['in'] for c in e['clips'])
 e['audio_master']={**e.get('audio_master',{}),'music_below_voice_lu':9}
 e['effects']=[]
 for s in e['sounds']:s['gain_db']=max(s['gain_db'],-24)
 def accent(t,preset='blur_pass'):
  t=round(max(0,t-.09),3)
  if not any(abs(x['time']-t)<.35 for x in e['effects']):e['effects'].append({'preset':preset,'time':t,'duration':.18,'intensity':.6})
  e['sounds']=[s for s in e['sounds'] if abs(s['time']-t)>.3]
  e['sounds'].append({'preset':'swipe','time':t,'gain_db':-23})
 def image_broll(name,at,duration):
  e['broll'].append({'source':str(A/(name+'-animated.mp4')),'in':0,'out':duration,'at':at,'fade_in':.12,'fade_out':.12,'reason':'Imagen educativa generada e identificada como ilustrativa: '+name})
  accent(at);accent(at+duration,'soft_flash')
 if slug=='diseno-sonrisa':image_broll('carillas',6.18,2.25);accent(1.92,'whip_pan')
 elif slug=='proceso-sonrisa':image_broll('encerado',4.65,2.8);accent(10.97,'blur_pass')
 elif slug=='blanqueamiento-antes':image_broll('color',6.5,2.65);accent(3.81,'whip_pan')
 elif slug=='hilo-correcto':
  e['broll'].append({'source':'/Users/ericperez/Nate Media/delian-loyola-video/media/source-2026-08-10/DJI_20260810154449_0305_D.MP4','in':2,'out':4.2,'at':1.05,'fade_in':.12,'fade_out':.12,'reason':'Uso real de hilo dental al presentar el tema, antes de la demostración en modelo.'})
  accent(1.05);accent(3.25);accent(27.78,'blur_pass');accent(32.53,'blur_pass')
 elif slug=='ultima-limpieza':
  accent(2.61,'whip_pan')
  for b in e['broll']:accent(b['at']);accent(b['at']+b['out']-b['in'],'soft_flash')
 # A short matching lead-in at the actual official-outro boundary, without duplicating outro audio.
 accent(total-.18,'blur_pass')
 e['sounds']=[s for s in e['sounds'] if s['time']+({'swipe':.18,'whoosh_soft':.28,'pop':.13,'mouse_click':.09}.get(s['preset'],.3))<=total]
 e['review_notes'].append('Eric requested transition effects, sounds, video B-roll, image B-roll and background music. Generated educational images explicitly labeled; new per-reel music balance 9 LU below voice. Critical listening pending.')
 dest=next_free_path(old);dest.write_text(json.dumps(e,ensure_ascii=False,indent=2));plan.append({'edit':str(dest),'video':str(R/'runs'/(dest.stem+'.mp4')),'previous':item['video'],'title':item['title'],'duration_body':total})
(D/'render-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2))
p=R/'styles/delian-feedback.json';profile=json.loads(p.read_text());profile['transition_broll_music_request']={'date':'2026-09-23','scope':'Delian September five','request':'Transiciones con efectos y sonidos, B-roll de video e imágenes, música de fondo','rule':'Aplicar los cinco recursos al lote con apoyos semánticos; imágenes generadas identificadas como ilustrativas, conservar demostraciones, efectos ligados a cambios visuales, música 9 LU por debajo de voz como punto inicial medido; escucha crítica pendiente.'};p.write_text(json.dumps(profile,ensure_ascii=False,indent=2))
print(json.dumps(plan,ensure_ascii=False))
