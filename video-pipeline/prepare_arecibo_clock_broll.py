from pathlib import Path
import cv2,math,json,subprocess
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent
F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
src=R/'media/arecibo/DJI_20260909092729_0278_D.MP4'
cap=cv2.VideoCapture(str(src));fps=cap.get(cv2.CAP_PROP_FPS)
font=ImageFont.truetype(str(R/'media/arecibo/brand/Montserrat-Bold.ttf'),105)
card=R/'media/arecibo/0271-clock-broll-v6.mp4'
p=subprocess.Popen([F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-threads','3','-pix_fmt','yuv420p',str(card)],stdin=subprocess.PIPE)
for n in range(85):
 t=n/30;cap.set(cv2.CAP_PROP_POS_MSEC,(.3+t*.45)*1000);ok,frame=cap.read();assert ok
 im=Image.fromarray(cv2.cvtColor(cv2.resize(frame,(1080,1920)),cv2.COLOR_BGR2RGB)).convert('RGBA')
 layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer);cx,cy,r=540,1310,245
 d.ellipse((cx-r-12,cy-r-12,cx+r+12,cy+r+12),fill=(17,100,135,240))
 d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(246,250,253,245))
 minute=15 if t<1.4 else 30
 d.pieslice((cx-r+14,cy-r+14,cx+r-14,cy+r-14),-90,-90+minute*6,fill=(156,230,8,100))
 for k in range(60):
  a=k*math.pi/30-math.pi/2;rr=r-20;ln=18 if k%5==0 else 8
  d.line((cx+math.cos(a)*rr,cy+math.sin(a)*rr,cx+math.cos(a)*(rr-ln),cy+math.sin(a)*(rr-ln)),fill='#116487',width=5 if k%5==0 else 2)
 # Short outer hand pulses with every audible tick/tock; numeral tracks spoken duration.
 a=(-90+minute*6+int(t/.4)%2*2)*math.pi/180
 d.line((cx+math.cos(a)*157,cy+math.sin(a)*157,cx+math.cos(a)*201,cy+math.sin(a)*201),fill='#116487',width=10)
 d.text((cx,cy),str(minute),font=font,fill='#152636',anchor='mm')
 im=Image.alpha_composite(im,layer).convert('RGB');p.stdin.write(im.tobytes())
p.stdin.close();assert p.wait()==0;cap.release()
d=json.loads((R/'edits/arecibo-resultados-0271-v5.json').read_text())
d['captions']=[dict(c,end=min(c['end'],7.42)) for c in d['captions'] if c['start']<7.42]
d['broll'][0].update(source='../media/arecibo/0271-clock-broll-v6.mp4',reason='Real workstation B-roll 0278 source 0.3-1.56 seconds, before turn and speech; slowed, clock with numerals only. No reused shot within reel.')
d['previous_version']='../runs/arecibo-resultados-0271-v5.mp4'
d['review_notes'].append('V6: replace empty graphic background with unique pre-speech workstation B-roll; graphic has only 15 and 30 with clock and tic-tac, no words or speech captions during graphic.')
(R/'edits/arecibo-resultados-0271-v6.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
