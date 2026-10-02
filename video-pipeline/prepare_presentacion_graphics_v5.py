"""Medical motion graphics at 1080x1920; paths/font rasterized at 2x final size.

Supersample only the moving panel, then reduce to native output resolution.
No enlarged low-resolution raster graphics are reused.
"""
from pathlib import Path
from functools import lru_cache
import json,math,subprocess
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent
F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
START=3.55;DURATION=3.10;FPS=30;S=4 # old 540-coordinate design -> native1080 -> 2x antialias

@lru_cache(None)
def font(n):return ImageFont.truetype(str(R/'media/arecibo/brand/Montserrat-Bold.ttf'),round(n*S))
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def box(coords):return tuple(round(v*S) for v in coords)
def pts(points):return [tuple(round(v*S) for v in point) for point in points]
def line(d,points,fill,width):d.line(pts(points),fill=fill,width=round(width*S),joint='curve')
def ellipse(d,coords,fill):d.ellipse(box(coords),fill=fill)
def text(d,xy,label,n,fill):d.text(box(xy),label,font=font(n),fill=fill)

def panel(t):
 p=Image.new('RGBA',(460*S,145*S));d=ImageDraw.Draw(p)
 d.rounded_rectangle(box((0,0,459,144)),radius=22*S,fill=(10,34,49,239),outline=(84,130,144,230),width=S)
 line(d,[(25,124),(430,124)],(156,230,8,95),1)
 # Continuous curved DNA strands, with shaded nodes and anti-aliased rungs.
 for side,col in [(1,(156,230,8,255)),(-1,(64,181,222,255))]:
  path=[(61+side*24*math.sin((y-17)/9*.65+t*1.8),y) for y in [17+k*.4 for k in range(204)]]
  line(d,path,col,1.7)
 for j in range(10):
  y=17+j*9;phase=j*.65+t*1.8;x1=61+24*math.sin(phase);x2=61-24*math.sin(phase)
  line(d,[(x1,y),(x2,y)],(138,177,187,220),1.8)
  for x,col in [(x1,(156,230,8,255)),(x2,(64,181,222,255))]:
   ellipse(d,(x-4,y-4,x+4,y+4),col);ellipse(d,(x-2,y-3,x,y-1),(239,250,253,255))
 text(d,(112,37),'PRUEBAS',13,'#8EABB8');text(d,(112,59),'Moleculares',20,'white')
 if t>=4.96:
  q=ease((t-4.96)/.2);lay=Image.new('RGBA',p.size);g=ImageDraw.Draw(lay)
  line(g,[(341,87),(341,58),(321,35)],'#9CE608',8)
  line(g,[(341,58),(365,35)],'#42B4D9',8)
  for x,y,col in [(321,35,'#9CE608'),(365,35,'#42B4D9'),(341,87,'#9CE608')]:
   ellipse(g,(x-4,y-4,x+4,y+4),col);ellipse(g,(x-2.5,y-2.5,x+2.5,y+2.5),'white')
  text(g,(287,105),'Serológicas',17,'white')
  lay.putalpha(lay.getchannel('A').point(lambda v:round(v*q)));p=Image.alpha_composite(p,lay)
 d=ImageDraw.Draw(p);text(d,(25,130),'ILUSTRACIÓN',8,'#8EABB8')
 return p.resize((920,290),Image.Resampling.LANCZOS)

def frame(t):
 out=Image.new('RGBA',(1080,1920));p=panel(t)
 a=ease((t-3.55)/.22)*(1-ease((t-6.35)/.25))
 p.putalpha(p.getchannel('A').point(lambda v:round(v*a)))
 out.alpha_composite(p,(80,round(1020+24*(1-a))));return out

if __name__=='__main__':
 out=R/'media/arecibo/presentacion-medical-hd-v5.mov'
 cmd=[F,'-v','error','-n','-f','rawvideo','-pix_fmt','rgba','-s','1080x1920','-r',str(FPS),'-i','-','-an','-c:v','qtrle',str(out)]
 enc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for n in range(round(DURATION*FPS)):enc.stdin.write(frame(START+n/FPS).tobytes())
 enc.stdin.close();assert enc.wait()==0
 edit=json.loads((R/'edits/arecibo-presentacion-0278-v4.json').read_text())
 edit['broll'][0]={'source':'../media/arecibo/presentacion-medical-hd-v5.mov','in':0,'out':DURATION,'at':START,'kind':'brand_graphic','reason':'Medical paths and typography rendered at 2x final panel size then downsampled; transparent native1080x1920 intermediate. No low-resolution enlargement.'}
 edit['previous_version']='../runs/arecibo-presentacion-0278-v4.mp4'
 edit['review_notes']+=['v5: replaces540x960 medical overlay with native1080x1920; vector paths/font rendered with2x supersampling. Smooth DNA curves and rounded antibody strokes. Locationv4, voice, timings, music, captions and outro preserved. Visual verification and approval required.']
 (R/'edits/arecibo-presentacion-0278-v5.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2))
 frame(5.7).save(R/'runs/arecibo-medical-hd-v5.png')
