import json,subprocess
from pathlib import Path
F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
font=str(Path('media/brand/QUARTZO.ttf').resolve())
flt="[1:v]crop=1147:781:66:207,scale=760:-1[logo];[0:v][logo]overlay=(W-w)/2:'300+35*exp(-9*t)',drawtext=fontfile='"+font+"':text='CELEBRA SIN':fontsize=83:fontcolor=0xcc008f:x=(w-tw)/2:y=950,drawtext=fontfile='"+font+"':text='PREOCUPACIONES':fontsize=70:fontcolor=0x0079d9:x=(w-tw)/2:y=1060"
subprocess.run([F,'-v','error','-y','-f','lavfi','-i','color=c=0xfff8ee:s=1080x1920:r=30:d=1.4','-loop','1','-i','media/brand/logo.png','-filter_complex',flt,'-t','1.4','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','media/practico-brand-intro.mp4'],check=True)
e=json.load(open('edits/practico-v10.json'));e['previous_version']='../runs/nanas-practico-v10.mp4';e['clips']=[{'in':1.04,'out':9.4,'zoom':1.02}]
for c in e['captions']:
 if c['start']>=4.52:c['start']=round(c['start']+.12,3);c['end']=round(c['end']+.12,3)
e['broll']=[{'source':'../media/practico-brand-intro.mp4','in':0,'out':1.4,'at':0,'eof_action':'repeat','reason':'Gráfica de marca cubre gesto inicial incongruente; luego presentador continuo.'},{'source':'../media/8896a768-7fe7-463b-9008-43fd7099941b.mp4','in':1.35,'out':3.23,'at':5.36,'eof_action':'repeat','reason':'Niños jugando con cocinita al mencionar entretenimiento. Toma sin uso previo, revisada por agente shot_review.'}]
e['sounds']=[{'time':t,'kind':'click','timbre':'mouse','gain_db':-12,'duration':.09,'reason':'Inicio de punto enumerado'} for t in [4.64,5.36,7.24]]
e['list_markers']=[{'number':1,'start':4.64,'end':5.36},{'number':2,'start':5.36,'end':7.24},{'number':3,'start':7.24,'end':8.16}]
e['review_notes'].append('Rehecho con equipo shot_review/timeline_review: presentador continuo, intro gráfica1.4s, una toma pertinente durante entretenimiento; sin limpieza falsa, piscina genérica ni carrito. Números y clicks alineados con cada punto. Escucha crítica pendiente.')
T=8.36;bed='media/music/nanas-practico-v11-bed.wav';subprocess.run([F,'-v','error','-y','-ss','3','-i','media/music/Compy Jazz.mp3','-t',str(T),'-ac','2','-ar','48000','-af',f'loudnorm=I=-27:TP=-9:LRA=7,afade=t=in:d=0.06,afade=t=out:st={T-.45}:d=0.45',bed],check=True);e['music']['source']='../'+bed
json.dump(e,open('edits/practico-v11.json','w'),ensure_ascii=False,indent=2)
