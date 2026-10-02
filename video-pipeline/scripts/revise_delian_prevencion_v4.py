from pathlib import Path
import json, shutil, subprocess, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

R=Path(__file__).resolve().parents[1]
D=Path('/Volumes/Extreme SSD/Nate Media/delian-prevencion-v4')
D.mkdir(exist_ok=True)
FF='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
manifest=json.loads((R/'edits/delian-prevencion-v4-assets.json').read_text())
font=str(R/'media/delian/brand/Shoika-SemiBold.otf')
def run(args): subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
for asset in manifest['assets']:
    dst=D/(asset['name']+'.png')
    shutil.copyfile(asset['path'],dst)
    asset['original_generation']=asset['path'];asset['path']=str(dst)
    asset['kind']='generated_3d_educational_render_animated_as_2d_video'
    asset['reserved_for']='prevencion-caries-20260921'
    dur={'caries':2.2,'nervio':3.36,'limpieza':1.85}[asset['name']]
    frames=math.ceil(dur*30)
    e=f'(3*pow(on/{frames-1},2)-2*pow(on/{frames-1},3))'
    z=f'1.015+0.07*{e}' if asset['name']!='nervio' else f'1.085-0.07*{e}'
    vf=f"scale=2160:3840,zoompan=z='{z}':x='iw/2-iw/zoom/2':y='(ih-ih/zoom)*0.35':d={frames}:s=1080x1920:fps=30,format=yuv420p"
    run([FF,'-v','error','-y','-i',str(dst),'-vf',vf,'-frames:v',str(frames),'-c:v','libx264','-preset','fast','-crf','17','-an',str(D/(asset['name']+'.mp4'))])
    print('Animated',asset['name'],flush=True)

# Original kinetic typography / calendar motion, drawn from scratch as video frames.
W,H=1080,1920
yy,xx=np.mgrid[0:H,0:W]
g=np.exp(-(((xx-320)/820)**2+((yy-430)/950)**2))[:,:,None]
bg=np.uint8(np.array([18,10,25])+g*np.array([40,23,48]))
f=lambda n:ImageFont.truetype(font,n)
def text_center(draw,txt,y,sz,fill):
    draw.text((540,y),txt,font=f(sz),fill=fill,anchor='mt')
def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
p=subprocess.Popen([FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',str(D/'calendario.mp4')],stdin=subprocess.PIPE)
for frame in range(99):
    t=frame/30;im=Image.fromarray(bg.copy());dr=ImageDraw.Draw(im)
    offset=round(55*(1-ease(t/.45))-8*ease(t/3.3))
    text_center(dr,'PREVENCIÓN',295,57,(235,218,245))
    # Extruded rounded calendar card, violet top edge and binding rings.
    for depth in range(24,0,-3):
        dr.rounded_rectangle((185+depth,455+offset+depth,895+depth,1135+offset+depth),48,fill=(43+depth//3,25+depth//4,57+depth//2))
    dr.rounded_rectangle((185,455+offset,895,1135+offset),48,fill=(243,237,248))
    dr.rounded_rectangle((185,455+offset,895,608+offset),48,fill=(168,81,196))
    dr.rectangle((185,540+offset,895,608+offset),fill=(168,81,196))
    for x in (330,750):
        dr.rounded_rectangle((x-16,412+offset,x+16,505+offset),16,fill=(214,183,232))
    dr.text((540,501+offset),'TU PRÓXIMA VISITA',font=f(35),fill='white',anchor='mt')
    if t<1.60:
        for row in range(4):
            for col in range(6):
                x=282+col*103;y=698+row*100+offset
                active=row*6+col<int(ease(t/1.5)*24)
                dr.rounded_rectangle((x-25,y-25,x+25,y+25),13,fill=(173,96,196) if active else (224,212,232))
    else:
        d=round(32*(1-ease((t-1.6)/.22)))
        dr.text((540,645+offset+d),'6',font=f(290),fill=(86,36,112),anchor='mt')
        dr.text((540,974+offset+d),'MESES',font=f(60),fill=(108,68,128),anchor='mt')
    for i in range(6):
        x=260+i*99
        dr.rounded_rectangle((x,1196,x+66,1204),4,fill=(197,134,220) if t>(i+1)*.27 else (65,41,77))
    p.stdin.write(im.tobytes())
p.stdin.close()
if p.wait():raise RuntimeError('calendar encode failed')
manifest['assets'].append({'name':'calendario','path':str(D/'calendario.mp4'),'kind':'original_kinetic_typography_calendar_animation','reserved_for':'prevencion-caries-20260921'})
(D/'asset-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
shutil.copyfile('/Volumes/Extreme SSD/Nate Media/delian-prevencion-v3/caption.txt',D/'caption.txt')
e=json.loads((R/'edits/delian-prevencion-caries-20260921-v3.json').read_text())
e['broll']=[]
for name,at,dur,reason in [('caries',1.15,2.2,'Vista macro conceptual de caries durante el gancho.'),('nervio',5.3,3.36,'Corte anatómico conceptual de esmalte, dentina y pulpa durante nervio y conductos; no simula un procedimiento ni resultado.'),('calendario',12.26,3.30,'Calendario animado: prevención y seis meses sincronizados con la narración.'),('limpieza',15.56,1.85,'Modelo educativo de instrumental de limpieza profesional, sin representar un paciente de DML.')]:
    e['broll'].append({'source':str(D/(name+'.mp4')),'in':0,'out':dur,'at':at,'fade_in':0,'fade_out':0,'reason':reason,'provenance':str(D/'asset-provenance.json'),'asset_family':'prevencion-v4-'+name})
e['effects']=[{'preset':'punch_zoom','time':x-.17,'duration':.34,'intensity':.5} for x in [1.15,5.3,12.26,17.41]]
e['sounds']=[{'preset':'mouse_click','time':x,'gain_db':-23} for x in [1.15,3.35,5.3,8.66,12.26,15.56,17.41,20.06]]
e['review_notes'].append('v4: reemplaza TODOS los B-rolls por tres ilustraciones dentales 3D nuevas animadas y un calendario de motion graphics original. Recursos exclusivos para este reel, sin reutilizar apoyos de otros reels. Voz, cortes, captions, música y outro conservados. Sin rótulo Imagen ilustrativa por instrucción del usuario; procedencia fuera de pantalla.')
(R/'edits/delian-prevencion-caries-20260921-v4.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
print('Assets and recipe ready',flush=True)
