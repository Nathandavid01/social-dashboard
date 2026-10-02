import json,subprocess
from pathlib import Path
from pipeline import FFMPEG,render
R=Path(__file__).resolve().parent;O=R/'runs';font=str(R/'media/brand/QUARTZO.ttf')
f="[1:v]crop=1147:781:66:207,scale=700:-1[logo];[0:v][logo]overlay=(W-w)/2:300,drawtext=fontfile='"+font+"':text='PLAZA MONSERRATE':fontsize=70:fontcolor=0xcc008f:x=(w-tw)/2:y=970,drawtext=fontfile='"+font+"':text='HORMIGUEROS':fontsize=83:fontcolor=0x0079d9:x=(w-tw)/2:y=1080"
subprocess.run([FFMPEG,'-v','error','-y','-f','lavfi','-i','color=c=0xfff8ee:s=1080x1920:r=30:d=2.82','-loop','1','-i',str(R/'media/brand/logo.png'),'-filter_complex',f,'-t','2.82','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',str(R/'media/parque-location-card.mp4')],check=True)
items=json.load(open(O/'catalog-reedit-items.json'))
for x in items:
 s,v,_=x
 if s not in {'indoor','parque'}:continue
 e=json.load(open(R/f'edits/{s}-v{v}.json'));e['previous_version']=f'../runs/nanas-{s}-v{v}.mp4'
 for b in e['broll']:
  if s=='indoor' and 'c581c160' in b['source']:b.update(**{'in':12,'out':15.9},reason='Recorrido del área de juegos sin escena de decoración/familias repetida; reservado a este reel.')
  if s=='parque' and 'venue-wide' in b['source']:b.update(source='../media/parque-location-card.mp4',reason='Ubicación gráfica cuando se menciona Plaza Monserrate/Hormigueros; elimina recorrido de chorrera similar a otro reel.');b.pop('zoom_keyframes',None)
 e['review_notes'].append('Comparación visual adicional: separar escena de cumpleaños y recorrido de chorrera aunque fueran archivos distintos.')
 dest=R/f'edits/{s}-v{v+1}.json';dest.write_text(json.dumps(e,ensure_ascii=False,indent=2));render(dest,O/f'nanas-{s}-v{v+1}.mp4');x[1]=v+1
 (O/'catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False))
