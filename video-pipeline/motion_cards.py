"""Render reusable, original vector-style motion cards and framed B-roll to MP4.

Captions/audio are added by pipeline.py; derived video keeps its source in recipe metadata.
"""
import argparse, json, math, subprocess
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
FF='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
W,H,FPS=1080,1920,30
PINK='#D40083'; INK='#432039'; CREAM='#FFF8ED'; BLUE='#0077C8'; YELLOW='#FFD530'
@lru_cache(None)
def font(size, number=False):
 return ImageFont.truetype(str(Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf') if number else ROOT/'media/brand/QUARTZO.ttf'),size)
def ease(t): return 1-(1-max(0,min(1,t)))**3
def text(im,s,x,y,size=85,color=INK,number=False):
 d=ImageDraw.Draw(im); f=font(size,number); b=d.textbbox((0,0),s,font=f)
 d.text((x-(b[2]-b[0])/2,y-b[1]),s,font=f,fill=color)
def star(d,x,y,r,color,angle=0):
 p=[(x+math.cos(angle-math.pi/2+i*math.pi/5)*(r if i%2==0 else r*.46),y+math.sin(angle-math.pi/2+i*math.pi/5)*(r if i%2==0 else r*.46)) for i in range(10)]
 d.polygon(p,fill=color)
def check(d,x,y,p,color=PINK):
 pts=[(x,y),(x+20,y+23),(x+64,y-29)];length=[math.dist(pts[0],pts[1]),math.dist(pts[1],pts[2])];remain=sum(length)*max(0,min(1,p))
 for a,b,l in zip(pts,pts[1:],length):
  if remain<=0:break
  q=min(1,remain/l);d.line([a,(a[0]+q*(b[0]-a[0]),a[1]+q*(b[1]-a[1]))],fill=color,width=10);remain-=l

def broom(d,x,y,t,scale=1):
 shift=30*math.sin(t*5);x+=shift
 def p(a,b):return (x+a*scale,y+b*scale)
 d.line([p(-50,130),p(75,-160)],fill=INK,width=max(3,int(23*scale)))
 d.polygon([p(-90,70),p(-12,104),p(-32,205),p(-162,148)],fill=YELLOW)
 d.line([p(-91,70),p(-12,104)],fill=PINK,width=max(3,int(30*scale)))
 for a in range(4): d.line([p(-115+a*24,128+a*9),p(-143+a*27,156+a*12)],fill='#DF9B18',width=max(2,int(6*scale)))
 for j in range(3):star(d,x+120+j*42,y+50+math.sin(t*4+j)*30,(16+j*3)*scale,BLUE,t*.2)

def house(d,x,y,t,scale=1):
 s=scale*(.94+.06*ease(t/.28))
 def p(a,b):return(x+a*s,y+b*s)
 d.rounded_rectangle([p(-135,-20),p(135,195)],radius=18,fill='#FCE2EF',outline=PINK,width=max(2,int(12*s)))
 d.line([p(-177,-5),p(0,-155),p(177,-5)],fill=PINK,width=max(3,int(24*s)),joint='curve')
 d.rounded_rectangle([p(-31,67),p(39,191)],radius=7,fill=CREAM,outline=PINK,width=max(2,int(8*s)))
 d.rounded_rectangle([p(66,26),p(108,74)],radius=5,fill=BLUE)
 star(d,x+195*s,y-110*s,32*s,YELLOW,t*.2)

LOGO=Image.open(ROOT/'media/brand/logo.png').convert('RGBA')
LOGO=LOGO.crop(LOGO.getchannel('A').getbbox())
def brand(im,y=75,width=260):
 a=LOGO.resize((width,round(width*LOGO.height/LOGO.width)),Image.Resampling.LANCZOS);im.paste(a,((W-width)//2,y),a)
def progress(im,number,t):
 d=ImageDraw.Draw(im)
 for i in range(3):
  x=372+i*118;active=i<number
  d.rounded_rectangle((x,1505,x+96,1519),radius=7,fill=PINK if active else '#EBD4DE')
  if i==number-1:check(d,x+17,1561,ease(t/.22))
def graphic(scene,t):
 im=Image.new('RGB',(W,H),CREAM);d=ImageDraw.Draw(im)
 d.ellipse((-290,1270,420,1990),fill='#FBE9F0');d.ellipse((850,-270,1350,240),fill='#FFEEC6')
 brand(im)
 if scene['template']=='hook':
  # Number stays present on the first frame; two staggered lines slide into place.
  yy=390+int(40*(1-ease(t/.28)))
  text(im,'3',535,yy,390,PINK,True)
  star(d,245,560,48,YELLOW,-.16+t*.12);star(d,810,720,35,BLUE,.2-t*.1)
  text(im,'PREOCUPACIONES',540,840+int(35*(1-ease(t/.23))),82,INK)
  text(im,'MENOS',540,982+int(40*(1-ease((t-.08)/.26))),112,PINK)
  d.line((360,1118,360+int(360*ease((t-.12)/.4)),1118),fill=YELLOW,width=15)
  for i in range(3):
   x=396+i*144;d.ellipse((x-36,1515,x+36,1587),fill=(PINK,BLUE,'#C18A00')[i]);text(im,str(i+1),x,1528,44,'white',True)
 elif scene['template'] in ('clean','home'):
  n=scene['number'];progress(im,n,t)
  yy=355+int(24*(1-ease(t/.2)))
  d.rounded_rectangle((77,yy+12,1003,1170),radius=65,fill='#F0DCE6')
  d.rounded_rectangle((68,yy,1012,1158),radius=65,fill='white')
  # Large number is part of the layout, not the caption and never covers a face.
  d.ellipse((445,yy-66,635,yy+124),fill=PINK)
  text(im,str(n),540,yy-38,125,'white',True)
  if n==1:broom(d,540,690,t,1.1)
  else:house(d,540,675,t,1.05)
  text(im,'SIN' if n==1 else 'SIN PRESTAR',540,960,85,PINK)
  text(im,'LIMPIAR' if n==1 else 'TU CASA',540,1058,85,INK)
 return im

def render(scene,out):
 if out.exists():raise ValueError(f'Already exists: {out}')
 duration=scene['duration'];frames=math.ceil(duration*FPS-1e-8)
 video=None
 if scene['template']=='broll':
  video=subprocess.Popen([FF,'-v','error','-ss',str(scene['source_in']),'-i',str(ROOT/scene['source']),'-an','-vf','fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920','-frames:v',str(frames),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
 out.parent.mkdir(exist_ok=True,parents=True)
 enc=subprocess.Popen([FF,'-v','error','-n','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','18','-threads','3','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
 try:
  for i in range(frames):
   t=i/FPS
   if video:
    # The entire portrait stays visible; no reframing to hide faces or actions.
    raw=video.stdout.read(W*H*3)
    if len(raw)!=W*H*3:raise ValueError('B-roll is shorter than requested')
    im=Image.frombytes('RGB',(W,H),raw)
    # Upper band leaves children's faces (middle of frame) and caption zone clear.
    band=Image.new('RGBA',(W,H));d=ImageDraw.Draw(band)
    for y in range(420):d.line((0,y,W,y),fill=(40,13,32,int(155*(1-y/420))))
    im=Image.alpha_composite(im.convert('RGBA'),band).convert('RGB');d=ImageDraw.Draw(im)
    xx=90+int(25*(1-ease(t/.2)))
    d.rounded_rectangle((xx,175,xx+162,337),radius=48,fill=PINK)
    text(im,'2',xx+81,201,112,'white',True)
    text(im,'JUEGOS',598,190,85,'white');text(im,'PARA ELLOS',598,283,74,'white')
    for j in range(3): d.rounded_rectangle((85+j*107,385,170+j*107,398),radius=6,fill='white' if j<2 else '#A6A6A6')
   else:im=graphic(scene,t)
   enc.stdin.write(im.tobytes())
 finally:
  enc.stdin.close()
  if video:video.stdout.close();video.wait()
 if enc.wait()!=0:raise RuntimeError('Motion-card encode failed')
 print(out,flush=True)

def main():
 p=argparse.ArgumentParser();p.add_argument('spec',type=Path);a=p.parse_args();s=json.loads(a.spec.read_text())
 for scene in s['scenes']:render(scene,ROOT/scene['output'])
if __name__=='__main__':main()
