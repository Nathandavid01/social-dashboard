import json,subprocess,hashlib
from pathlib import Path
from pipeline import FFMPEG,render
R=Path(__file__).resolve().parent;O=R/'runs';items=json.load(open(O/'catalog-reedit-items.json'));locked={'padres','snacks','cumpleanos'}
protected={s:{'version':v,'sha256':hashlib.sha256((O/f'nanas-{s}-v{v}.mp4').read_bytes()).hexdigest()} for s,v,_ in items if s in locked}
font=str(R/'media/brand/QUARTZO.ttf')
f="[1:v]crop=1147:781:66:207,scale=680:-1[logo];[0:v][logo]overlay=(W-w)/2:300,drawtext=fontfile='"+font+"':text='TU ACTIVIDAD':fontsize=84:fontcolor=0xcc008f:x=(w-tw)/2:y=930,drawtext=fontfile='"+font+"':text='EN EXCLUSIVA':fontsize=84:fontcolor=0x0079d9:x=(w-tw)/2:y=1040"
subprocess.run([FFMPEG,'-v','error','-y','-f','lavfi','-i','color=c=0xfff8ee:s=1080x1920:r=30:d=2.86','-loop','1','-i',str(R/'media/brand/logo.png'),'-filter_complex',f,'-t','2.86','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',str(R/'media/indoor-private-event.mp4')],check=True)
for item in items:
 s,v,_=item
 if s not in {'indoor','fin-de-semana'}:continue
 e=json.load(open(R/f'edits/{s}-v{v}.json'));e['previous_version']=f'../runs/nanas-{s}-v{v}.mp4'
 if s=='fin-de-semana':
  e['broll']=[b for b in e['broll'] if b['source']==e['source']]+[{'source':'../media/2ff43f37-3ae9-4cd9-b86c-f53c0d4c3ccf.mp4','in':0.2,'out':1.52,'at':2.96,'eof_action':'repeat','reason':'Carrito rojo: toma reservada para este reel, distinta de cocinita en práctico. Presentador durante mensaje de seguridad.'}]
  e['transitions']=[]
  e['sounds']=[x for x in e['sounds'] if x['kind']!='whoosh']
 else:
  for b in e['broll']:
   if '6fdc1ad9' in b['source']:b.update(source='../media/indoor-private-event.mp4',**{'in':0,'out':2.86,'at':8.4},reason='Gráfica de evento privado durante cerrado para tu actividad: elimina B-roll reservado a Dónde Celebrar Su Cumpleaños.');b.pop('zoom_keyframes',None)
  # End entertainment at the beginning of the private-event phrase.
  for b in e['broll']:
   if '8ed1af63' in b['source']:
    b['out']=1.88
    if 'zoom_keyframes' in b:b['zoom_keyframes'][-1]['time']=1.38
  e['transitions']=[]
 e['review_notes'].append('Auditoría de exclusividad del lote: tomas reservadas por video, tres videos excluidos intactos. Priorizar pertinencia y evitar recortes extraños para inventar tomas nuevas.')
 dest=R/f'edits/{s}-v{v+1}.json';dest.write_text(json.dumps(e,ensure_ascii=False,indent=2));render(dest,O/f'nanas-{s}-v{v+1}.mp4');item[1]=v+1
 (O/'catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False))
(O/'unique-broll-protected.json').write_text(json.dumps(protected,indent=2))
