"""Clock-only time graphic; tick positions share timestamps with sound events."""
from pathlib import Path
import math,json,subprocess
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
card=R/'media/arecibo/0271-clock-v3.mp4'
# Quarter hour settles before the spoken half-hour, then advances in equal steps.
steps=[(0,0),(.2,5),(.4,10),(.6,15),(1.4,20),(1.6,25),(1.8,30)]
p=subprocess.Popen([F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-threads','3','-pix_fmt','yuv420p',str(card)],stdin=subprocess.PIPE)
for n in range(85):
 t=n/30;minute=next(v for a,v in reversed(steps) if t>=a)
 im=Image.new('RGB',(1080,1920),'#F6FAFD');d=ImageDraw.Draw(im)
 cx,cy,r=540,800,330
 d.ellipse((cx-r-18,cy-r-10,cx+r+18,cy+r+26),fill='#E3EDF1')
 d.ellipse((cx-r,cy-r,cx+r,cy+r),fill='white',outline='#116487',width=9)
 if minute:d.pieslice((cx-r+22,cy-r+22,cx+r-22,cy+r-22),-90,-90+minute*6,fill='#E9F7CD')
 for k in range(60):
  a=k*math.pi/30-math.pi/2;rr=r-24;length=27 if k%5==0 else 11
  d.line((cx+math.cos(a)*rr,cy+math.sin(a)*rr,cx+math.cos(a)*(rr-length),cy+math.sin(a)*(rr-length)),fill='#116487' if k%5==0 else '#B8CDD6',width=7 if k%5==0 else 3)
 a=minute*math.pi/30-math.pi/2
 d.line((cx,cy,cx+math.cos(a)*(r-70),cy+math.sin(a)*(r-70)),fill='#116487',width=15)
 d.ellipse((cx-19,cy-19,cx+19,cy+19),fill='#9CE608')
 p.stdin.write(im.tobytes())
p.stdin.close();assert p.wait()==0
edit=json.loads((R/'edits/arecibo-resultados-0271-v2.json').read_text())
edit['broll'][0].update(source='../media/arecibo/0271-clock-v3.mp4',fade_in=0,reason='Clock-only quarter-to-half-hour graphic, equal hand increments synchronized to mechanical ticks; no graphic text.')
edit['sounds']=[e for e in edit['sounds'] if e['time']<7.42]
edit['sounds'] += [{'kind':'click','time':round(7.42+a,2),'duration':.04,'gain_db':-17} for a,v in steps[1:]]
edit['previous_version']='../runs/arecibo-resultados-0271-v2.mp4'
edit['review_notes'].append('V3: remove graphic text, clock dial advances in uniform five-minute steps with frame-aligned ticks. Captions preserve qualification; animation is illustrative, not a real countdown.')
(R/'edits/arecibo-resultados-0271-v3.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2)+'\n')
