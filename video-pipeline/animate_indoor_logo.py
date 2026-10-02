import subprocess,json
from pathlib import Path
F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
font='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
filters="[1:v]crop=1147:781:66:207,scale=880:-1[logo];[0:v][logo]overlay=x=(W-w)/2:y='360+65*exp(-7*t)*cos(14*t)':eval=frame,drawtext=fontfile='"+font+"':text='CELEBRA CON NOSOTROS':fontsize=49:fontcolor=0xcc008f:x=(w-tw)/2:y=1050,drawtext=fontfile='"+font+"':text='939-299-2969':fontsize=89:fontcolor=0x0079d9:x=(w-tw)/2:y=1150"
subprocess.run([F,'-v','error','-y','-f','lavfi','-i','color=c=0xfff8ee:s=1080x1920:r=30:d=7.46','-loop','1','-i','media/brand/logo.png','-filter_complex',filters,'-t','7.46','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','media/indoor-logo-contact.mp4'],check=True)
e=json.load(open('edits/indoor-v6.json'));e['previous_version']='../runs/nanas-indoor-v6.mp4';e['broll'][-1].update(source='../media/indoor-logo-contact.mp4',reason='Logo oficial con entrada de rebote suave y contacto durante el CTA.');e['review_notes'].append('Tarjeta de CTA renovada usando el logo oficial; entrada animada sincronizada con whoosh existente.');json.dump(e,open('edits/indoor-v7.json','w'),ensure_ascii=False,indent=2)
