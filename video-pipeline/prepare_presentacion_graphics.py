from pathlib import Path
import json,math,subprocess
from PIL import Image,ImageDraw,ImageFont
R=Path('/Users/ericperez/Nate Media/video-pipeline');F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
font=lambda n:ImageFont.truetype(str(R/'media/arecibo/brand/Montserrat-Bold.ttf'),n)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def draw(t):
 im=Image.new('RGBA',(540,960));p=Image.new('RGBA',(460,145));d=ImageDraw.Draw(p)
 if 3.55<=t<6.6:
  a=ease((t-3.55)/.22)*(1-ease((t-6.35)/.25));d.rounded_rectangle((0,0,459,144),22,fill=(10,34,49,239),outline=(84,130,144,230),width=1)
  d.line((25,124,430,124),fill=(156,230,8,95),width=1)
  # Animated DNA double helix, individual shaded atoms and connecting rungs.
  for j in range(10):
   y=17+j*9;phase=j*.65+t*1.8;x1=61+24*math.sin(phase);x2=61-24*math.sin(phase)
   d.line((x1,y,x2,y),fill=(138,177,187,220),width=2)
   for x,col in [(x1,(156,230,8,255)),(x2,(64,181,222,255))]:
    d.ellipse((x-4,y-4,x+4,y+4),fill=col);d.ellipse((x-2,y-3,x,y-1),fill='white')
  d.text((112,37),'PRUEBAS',font=font(13),fill='#8EABB8');d.text((112,59),'Moleculares',font=font(20),fill='white')
  if t>=4.96:
   q=ease((t-4.96)/.2);lay=Image.new('RGBA',p.size);g=ImageDraw.Draw(lay)
   # Antibody Y motif, clearly illustrative.
   g.line([(341,87),(341,58),(321,35)],fill='#9CE608',width=8);g.line([(341,58),(365,35)],fill='#42B4D9',width=8)
   for x,y in [(321,35),(365,35),(341,87)]:g.ellipse((x-5,y-5,x+5,y+5),fill='white')
   g.text((287,105),'Serológicas',font=font(17),fill='white');lay.putalpha(lay.getchannel('A').point(lambda v:int(v*q)));p=Image.alpha_composite(p,lay)
  d=ImageDraw.Draw(p);d.text((25,130),'ILUSTRACIÓN',font=font(8),fill='#8EABB8')
 elif 9.55<=t<13.45:
  a=ease((t-9.55)/.25)*(1-ease((t-13.15)/.3));d.rounded_rectangle((0,0,459,144),22,fill=(10,34,49,239),outline=(84,130,144,230),width=1)
  # Stylized locator, no invented map or route.
  d.ellipse((30,104,120,121),outline=(156,230,8,110),width=2)
  y=math.sin(t*2)*3;d.ellipse((50,22+y,99,72+y),fill='#9CE608');d.polygon([(53,62+y),(96,62+y),(75,104+y)],fill='#9CE608');d.ellipse((64,36+y,85,57+y),fill='#0A2231')
  d.text((145,27),'ARECIBO LAB',font=font(13),fill='#9CE608');d.text((145,51),'Barrio Factor',font=font(26),fill='white');d.text((145,90),'Arecibo, Puerto Rico',font=font(15),fill='#AEC4CF')
 else:return im
 p.putalpha(p.getchannel('A').point(lambda v:int(v*a)));im.alpha_composite(p,(40,int(510+12*(1-a))));return im
out=R/'media/arecibo/presentacion-graphics-v3.mov'
enc=subprocess.Popen([F,'-v','error','-n','-f','rawvideo','-pix_fmt','rgba','-s','540x960','-r','30','-i','-','-an','-c:v','qtrle',str(out)],stdin=subprocess.PIPE)
for n in range(408):enc.stdin.write(draw(n/30).tobytes())
enc.stdin.close();assert enc.wait()==0
edit=json.loads((R/'edits/arecibo-presentacion-0278-v2.json').read_text());edit['broll']=[{'source':'../media/arecibo/presentacion-graphics-v3.mov','in':0,'out':13.57,'at':0,'kind':'brand_graphic','reason':'Transparent medical illustration and location marker synchronized with spoken concepts; presenter remains visible.'}]
edit['sounds']=[{'kind':'preset','preset':'mouse_click','time':t,'duration':.09,'gain_db':-19} for t in [3.57,4.98,9.57]]
for c in edit['clips']:c['zoom_keyframes']=[{'time':0,'zoom':1},{'time':round(c['out']-c['in'],2),'zoom':1.025}]
edit['previous_version']='../runs/arecibo-presentacion-0278-v2.mp4';edit['review_notes']+=['v3: ADN y anticuerpo animados ilustran pruebas moleculares y serológicas, sin inventar resultados. Marcador de Barrio Factor en ubicación. Sin tapar rostro ni captions verdes. Sonidos en entradas. Aprobación de esta revisión pendiente.']
(R/'edits/arecibo-presentacion-0278-v3.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2))
for t in [4.2,5.5,11]:draw(t).save('/tmp/graphic-'+str(t)+'.png')
p=R/'styles/arecibo-feedback.json';f=json.loads(p.read_text());f['presentacion_graphics_rule']='En presentaciones con plano hablado vacío, añadir ilustraciones recortadas o gráficas animadas pertinentes a lo dicho (ADN, anticuerpos, ubicación). Conservar rostro libre y captions verdes fijos; entradas/salidas suaves y clicks discretos. No inventar credenciales ni resultados médicos.';p.write_text(json.dumps(f,ensure_ascii=False,indent=2))
