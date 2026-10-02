"""Tracked explanatory graphics; preserves original assets and exports."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,math,sys,shutil
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R));import pipeline
D=Path('/Volumes/Extreme SSD/Nate Media/delian-criterios-v2');D.mkdir(exist_ok=True)
old=R/'edits/delian-criterios-sonrisa-20260921-v1.json';dest=R/'edits/delian-criterios-sonrisa-20260921-v2.json';e=json.loads(old.read_text())
font=ImageFont.truetype(str(R/'media/delian/brand/Shoika-SemiBold.otf'),44);W,H=1080,1920;FF=pipeline.FFMPEG
purple=(178,62,218,255);white=(255,255,255,255);ink=(45,13,56,255)
def ease(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
def pill(d,text,x,y,p):
 if p<=0:return
 a=round(255*p);y+=round(20*(1-p));w=d.textbbox((0,0),text,font=font)[2]+48
 d.rounded_rectangle((x,y,x+w,y+78),radius=24,fill=(43,16,52,round(a*.94)),outline=(216,155,237,a),width=2);d.text((x+24,y+15),text,font=font,fill=(255,255,255,a))
def trace(d,pts,p,width=6):
 if p<=0:return
 lens=[math.dist(a,b) for a,b in zip(pts,pts[1:])];left=sum(lens)*min(1,p);path=[pts[0]]
 for a,b,l in zip(pts,pts[1:],lens):
  f=min(1,left/l) if l else 1;path.append((a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f));left-=l
  if left<=0:break
 if len(path)>1:d.line(path,fill=ink,width=width+5,joint='curve');d.line(path,fill=white,width=width,joint='curve')
 return path[-1]
def arrow(d,pts,p):
 tip=trace(d,pts,p)
 if tip and p>.95:
  a,b=pts[-2:];th=math.atan2(b[1]-a[1],b[0]-a[0]);w=[(b[0]-24*math.cos(th-k),b[1]-24*math.sin(th-k)) for k in [-.5,.5]]
  d.line([w[0],b,w[1]],fill=purple,width=11,joint='curve');d.line([w[0],b,w[1]],fill=white,width=5,joint='curve')
def ring(d,c,rx,ry,p):trace(d,[(c[0]+rx*math.cos(math.radians(-90+i*3)),c[1]+ry*math.sin(math.radians(-90+i*3))) for i in range(121)],p,5)
for b in e['broll']:
 src=Path(b['source']);name=src.stem;out=D/(name+'-annotated.mp4');frames=math.ceil(b['out']*30)
 if out.exists():raise RuntimeError('Preserve existing render '+str(out))
 dec=subprocess.Popen([FF,'-v','error','-i',str(src),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
 enc=subprocess.Popen([FF,'-v','error','-n','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
 for i in range(frames):
  raw=dec.stdout.read(W*H*3)
  if len(raw)!=W*H*3:raise RuntimeError('Short source')
  im=Image.frombytes('RGB',(W,H),raw);layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);t=i/30;z=1+.045*ease(i/(frames-1))
  def pt(x,y):return ((x-W*.5)*z+W*.5,(y-H*.32)*z+H*.32)
  if name=='planificacion':
   for k,txt in enumerate(['1 · Mordida','2 · Posición','3 · Armonía']):pill(d,txt,92,920+k*102,ease((t-.1-k*.38)/.28))
  elif name=='mordida':
   pill(d,'01 · Mordida',92,164,ease(t/.3));arrow(d,[pt(920,1080),pt(990,1010),pt(970,825),pt(878,703)],ease((t-.18)/.65));ring(d,pt(825,690),70*z,38*z,ease((t-.7)/.55))
  elif name=='posicion':
   pill(d,'02 · Posición',92,164,ease(t/.3));ring(d,pt(487,902),94*z,97*z,ease((t-.85)/.55));arrow(d,[pt(840,1158),pt(717,1122),pt(570,976)],ease((t-.98)/.5));pill(d,'Apiñamiento',630,1180,ease((t-1.13)/.25))
  elif name=='armonia':
   pill(d,'03 · Armonía facial',92,1010,ease(t/.3))
   for sign in [-1,1]:
    x=540+sign*245;trace(d,[pt(x-sign*45,300),pt(x,300),pt(x,720),pt(x-sign*45,720)],ease((t-.18)/.65),4)
   trace(d,[pt(466+170*j/50,621+23*math.sin(math.pi*j/50)) for j in range(51)],ease((t-.65)/.55),5);arrow(d,[pt(795,892),pt(746,797),pt(654,650)],ease((t-.9)/.55))
  im=Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')
  if i==min(frames-1,48):im.resize((540,960)).save(D/(name+'-check.jpg'))
  enc.stdin.write(im.tobytes())
 enc.stdin.close();dec.stdout.close()
 if dec.wait()!=0 or enc.wait()!=0:raise RuntimeError('Encode failed')
 b['original_source']=str(src);b['source']=str(out);b['annotation']='Tracked explanatory arrows and line graphics; no new clinical claims.';print('Annotated',name,flush=True)
e['review_notes'].append('v2 Eric: flechas y gráficas animadas sincronizadas a mordida, apiñamiento y armonía facial. Endpoints track keyframes; graphics above captions. Original audio, captions and cuts retained.')
dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n');shutil.copyfile('/Volumes/Extreme SSD/Nate Media/delian-criterios-v1/caption.txt',D/'caption.txt')
(D/'motion-graphics-provenance.json').write_text(json.dumps({'source_recipe':str(old),'edit':str(dest),'assets':e['broll'],'note':'Same-reel revision of exclusive conceptual assets, not patients or real results.'},ensure_ascii=False,indent=2))
def cp(src,dst):
 with open(src,'rb') as a,open(dst,'xb') as b:shutil.copyfileobj(a,b)
pipeline.os.link=cp
pipeline.render(dest,D/'delian-criterios-sonrisa-20260921-v2.mp4')
