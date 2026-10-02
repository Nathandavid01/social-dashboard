import json,subprocess
from pathlib import Path
from pipeline import FFMPEG,render
R=Path(__file__).resolve().parent
source=R/'media/c24fefc0-43f4-4c68-a152-079d3611d90c.mp4'
f="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawbox=x=455:y=780:w=170:h=170:color=0xd92235:t=fill,drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial Bold.ttf':text='X':fontsize=130:fontcolor=white:x=495:y=790"
subprocess.run([FFMPEG,'-v','error','-y','-ss','0.2','-i',str(source),'-t','2.22','-an','-vf',f,'-r','30','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',str(R/'media/security-no-food.mp4')],check=True)
e=json.load(open(R/'edits/seguridad-v6.json'));e['previous_version']='../runs/nanas-seguridad-v6.mp4';e['transitions']=[]
e['broll'] += [{'source':'../media/security-no-food.mp4','in':0,'out':2.22,'at':9.87,'eof_action':'repeat','reason':'Alimentos en mostrador con X roja explícita durante no se permiten alimentos en área de juegos. Derivado de catálogo29, reservado aquí.'},{'source':'../media/4d7d93f7-fdc4-4814-959d-763c84f81252.mp4','in':17.5,'out':19.2,'at':14.85,'eof_action':'repeat','reason':'Niño sube por escalones acolchados, uso correcto del equipo; no mostrar subida por superficie de chorrera.'}]
profile=json.load(open(R/'styles/nanas-audio.json'))
for x in e['sounds']:
 if x.get('reason')=='Inicio de punto enumerado':x.update(profile['list_click'])
e['review_notes'].append('Más demostraciones de reglas: supervisión, prohibición de alimentos señalada con X y escalones para uso del equipo. No inferir medias antideslizantes o juguetes externos de tomas que no lo demuestran.')
p=R/'edits/seguridad-v7.json';p.write_text(json.dumps(e,ensure_ascii=False,indent=2));render(p,R/'runs/nanas-seguridad-v7.mp4')
