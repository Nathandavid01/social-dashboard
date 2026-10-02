"""Motion Kit: configurable clock compositor with a shared visual/audio cue sheet."""
import argparse, json, math, subprocess, hashlib
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parent
FFMPEG='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
def ease(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
def validate(c):
 for k in ('duration','source_in','source_speed','radius','change_at','tick_interval'):
  if not isinstance(c[k],(int,float)) or not math.isfinite(c[k]):raise ValueError(k)
 if not .5<=c['duration']<=30 or c['source_in']<0 or not .1<=c['source_speed']<=2:raise ValueError('Invalid duration/source range')
 if not .1<c['change_at']<c['duration']-.2 or not .15<=c['tick_interval']<=1:raise ValueError('Invalid animation timing')
 if not 80<=c['radius']<=400 or any(not 0<=v<=60 for v in c['values']) or len(c['values'])!=2:raise ValueError('Clock needs two values in 0..60')
 if not (c['radius']<=c['center'][0]<=1080-c['radius'] and c['radius']<=c['center'][1]<=1920-c['radius']):raise ValueError('Clock outside frame')
 return c

def cues(c):
 return [{'kind':'preset','preset':'clock_tick' if i%2==0 else 'clock_tock','time':round(.18+i*c['tick_interval'],3),'duration':.1,'gain_db':c.get('tick_gain_db',-14)} for i in range(math.ceil(c['duration']/c['tick_interval'])) if .18+i*c['tick_interval']+.1<=c['duration']]

def dial(t,c):
 S=1000;cx=cy=500;r=412
 yy,xx=np.mgrid[:S,:S];dist=np.sqrt(((xx-380)/900)**2+((yy-220)/1100)**2)
 a=np.zeros((S,S,4),dtype=np.uint8)
 for ch,(hi,lo) in enumerate(((38,8),(66,20),(79,31))):a[:,:,ch]=np.clip(hi-(hi-lo)*dist,lo,hi)
 a[:,:,3]=np.where((xx-cx)**2+(yy-cy)**2<=r*r,253,0)
 im=Image.fromarray(a);d=ImageDraw.Draw(im)
 accent=c['accent'];blue=c['secondary']
 d.ellipse((cx-r,cy-r,cx+r,cy+r),outline='#71919B',width=3)
 d.ellipse((cx-r+10,cy-r+10,cx+r-10,cy+r-10),outline='#294853',width=2)
 blend=ease((t-c['change_at'])/.32)
 value=c['values'][0]+(c['values'][1]-c['values'][0])*blend
 # Precision dial marks, individually highlighted by elapsed range.
 dial_steps = 24 if c.get('unit') in ('h', 'horas') else 60
 for k in range(dial_steps):
  ang=k*2*math.pi/dial_steps-math.pi/2;outer=376;inner=outer-(26 if k%(6 if dial_steps==24 else 5)==0 else 10)
  color=accent if k<=value else '#67818C'
  d.line((cx+math.cos(ang)*inner,cy+math.sin(ang)*inner,cx+math.cos(ang)*outer,cy+math.sin(ang)*outer),fill=color,width=5 if k%5==0 else 2)
 arc=Image.new('RGBA',(S,S));g=ImageDraw.Draw(arc)
 g.arc((166,166,834,834),-90,-90+value*360/dial_steps,fill=accent,width=13)
 im=Image.alpha_composite(im,arc.filter(ImageFilter.GaussianBlur(13)))
 im=Image.alpha_composite(im,arc);d=ImageDraw.Draw(im)
 # Ticks pulse at precisely the same timestamps as generated audio events.
 age=min((t-e['time'] for e in cues(c) if t>=e['time']),default=10)
 pulse=math.exp(-age*18)
 ang=math.radians(-90+value*360/dial_steps);px=cx+334*math.cos(ang);py=cy+334*math.sin(ang)
 d.ellipse((px-8-pulse*5,py-8-pulse*5,px+8+pulse*5,py+8+pulse*5),fill=accent)
 d.arc((92,92,908,908),-130+t*13,-90+t*13,fill='#D7EBEF',width=4)
 font=ImageFont.truetype(str(ROOT/c['font']),205)
 # Two-number odometer: no invented intermediate result times.
 number_states = [(c['values'][0],1,0)] if c['values'][0] == c['values'][1] else [(c['values'][0],1-blend,-45*blend),(c['values'][1],blend,45*(1-blend))]
 for number,alpha,offset in number_states:
  text=Image.new('RGBA',(S,S));td=ImageDraw.Draw(text)
  td.text((500,495+offset),str(number),font=font,fill=(244,250,252,round(255*alpha)),anchor='mm',stroke_width=0)
  im=Image.alpha_composite(im,text)
 d=ImageDraw.Draw(im)
 if c.get('end_prefix') and blend>0:
  prefix_font=ImageFont.truetype(str(ROOT/c['font']),65)
  prefix_layer=Image.new('RGBA',(S,S))
  ImageDraw.Draw(prefix_layer).text((500,350),c['end_prefix'],font=prefix_font,fill=(215,235,239,round(255*blend)),anchor='mm')
  im=Image.alpha_composite(im,prefix_layer);d=ImageDraw.Draw(im)
 if c.get('unit'):
  unit_font=ImageFont.truetype(str(ROOT/c['font']),65)
  d.text((500,591),c['unit'],font=unit_font,fill='#D7EBEF',anchor='mm')
 # Small physical clock hands give the central number a time context without text.
 d.line((480,683,500,663,500,637),fill=blue,width=7)
 d.ellipse((493,656,507,670),fill=accent)
 return im

def render(config,output):
 c=validate(json.loads(config.read_text()));output=output.resolve()
 if output.exists():raise ValueError('Use a new output version')
 output.parent.mkdir(parents=True,exist_ok=True)
 source=(ROOT/c['source']).resolve();font=ROOT/c['font']
 if not source.is_file() or not font.is_file():raise ValueError('Missing source/font')
 work=output.with_suffix('.background.mp4')
 source_duration=c['duration']*c['source_speed']
 subprocess.run([FFMPEG,'-v','error','-y','-ss',str(c['source_in']),'-t',str(source_duration),'-i',str(source),'-an','-vf',f"setpts=PTS/{c['source_speed']},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30",'-c:v','libx264','-preset','fast','-crf','18','-threads','3',str(work)],check=True)
 cap=cv2.VideoCapture(str(work));enc=subprocess.Popen([FFMPEG,'-v','error','-n','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','17','-preset','fast','-threads','3','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],stdin=subprocess.PIPE)
 try:
  last=None
  for n in range(math.ceil(c['duration']*30)):
   ok,frame=cap.read()
   if ok:last=frame
   if last is None:raise ValueError('Empty B-roll')
   t=n/30;base=Image.fromarray(cv2.cvtColor(last,cv2.COLOR_BGR2RGB)).convert('RGBA')
   entry=ease(t/c.get('entry_duration',.38));leave=ease((t-(c['duration']-c.get('exit_duration',.4)))/max(.01,c.get('exit_duration',.4)-1/30));opacity=entry*(1-leave);scale=(.72+.28*entry)*(1-.18*leave)
   size=round(c['radius']*2/0.824*scale)
   face=dial(t,c).resize((size,size),Image.Resampling.LANCZOS)
   if opacity<1:face.putalpha(face.getchannel('A').point(lambda a:round(a*opacity)))
   x=round(c['center'][0]-size/2);y=round(c['center'][1]-size/2+60*(1-entry)-36*leave)
   shadow=Image.new('RGBA',base.size);sd=ImageDraw.Draw(shadow);rr=c['radius']*scale
   sd.ellipse((c['center'][0]-rr,c['center'][1]-rr+18,c['center'][0]+rr,c['center'][1]+rr+18),fill=(0,0,0,round(125*opacity)))
   base=Image.alpha_composite(base,shadow.filter(ImageFilter.GaussianBlur(18)))
   base.alpha_composite(face,(x,y));enc.stdin.write(base.convert('RGB').tobytes())
 finally:
  cap.release();enc.stdin.close()
 if enc.wait()!=0:raise RuntimeError('Encoder failed')
 manifest={'config':c,'output':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sound_events':cues(c),'review':'pending','note':'Illustrative time range, not a live countdown; silent composite, sounds supplied as timeline events.'}
 output.with_suffix('.motion.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(output)
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('config',type=Path);p.add_argument('output',type=Path);a=p.parse_args();render(a.config,a.output)
