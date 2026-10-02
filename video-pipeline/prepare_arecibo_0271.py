"""Create a private-screen proxy and factual animated result-time card for 0271."""
from pathlib import Path
import cv2,json,subprocess,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
src=Path('/Users/ericperez/Downloads/DJI_20260909091327_0271_D.LRF');out=R/'media/arecibo/0271-screen-private-v2.mp4'
# Coordinates are source pixels at 720x1280; expanded beyond the result window.
keys=np.array([[0,280],[1.7,280],[2.7,220],[3.7,190],[4.7,195],[5.7,90],[6.7,205],[7.7,220],[8.7,225],[9.7,225],[10.7,230],[11.7,230],[13.15,230]])
if not out.exists():
 cap=cv2.VideoCapture(str(src));fps=cap.get(cv2.CAP_PROP_FPS)
 enc=subprocess.Popen([F,'-v','error','-n','-f','rawvideo','-pix_fmt','bgr24','-s','720x1280','-r',str(fps),'-i','-','-i',str(src),'-map','0:v','-map','1:a:0','-c:v','libx264','-crf','16','-preset','fast','-threads','3','-c:a','copy','-map_metadata','-1','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
 n=0
 while True:
  ok,im=cap.read()
  if not ok:break
  t=n/fps;right=round(np.interp(t,keys[:,0],keys[:,1]));left=round(np.interp(t,[0,1.7,2.7],[60,60,0]));top=round(np.interp(t,[0,1.7,2.7,3.7,4.7,5.7,13.15],[425,425,360,290,300,315,315]));bottom=635;region=im[top:bottom,left:right]
  # Six coarse columns remove readable text; soften edges inside the expanded safe region.
  mosaic=cv2.resize(cv2.resize(region,(6,8),interpolation=cv2.INTER_AREA),(right-left,bottom-top),interpolation=cv2.INTER_LINEAR)
  im[top:bottom,left:right]=cv2.GaussianBlur(mosaic,(0,0),12)
  enc.stdin.write(im.tobytes());n+=1
 cap.release();enc.stdin.close();assert enc.wait()==0
 (out.with_suffix('.json')).write_text(json.dumps({'source':str(src),'treatment':'Interpolated source-pixel screen redaction before captions; no speech edits','x_right_keys':keys.tolist(),'top_keys':[[0,425],[1.7,425],[2.7,360],[3.7,290],[4.7,300],[5.7,315],[13.15,315]],'bottom':635,'left_keys':[[0,60],[1.7,60],[2.7,0]]},indent=2))
# Declarative card; original video motion, no invented photographic scene.
card=R/'media/arecibo/0271-resultados-card-v2.mp4'
if not card.exists():
 fontpath=str(R/'media/arecibo/brand/Montserrat-Bold.ttf');fonts={s:ImageFont.truetype(fontpath,s) for s in [44,60,70,100,150]}
 enc=subprocess.Popen([F,'-v','error','-n','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-threads','3','-pix_fmt','yuv420p',str(card)],stdin=subprocess.PIPE)
 def label(im,s,y,size,color):
  d=ImageDraw.Draw(im);b=d.textbbox((0,0),s,font=fonts[size]);d.text(((1080-(b[2]-b[0]))/2,y-b[1]),s,font=fonts[size],fill=color)
 for i in range(99):
  t=i/30;im=Image.new('RGB',(1080,1920),'#F6FAFD');d=ImageDraw.Draw(im)
  d.ellipse((740,-140,1260,380),fill='#E9F7CD');d.rounded_rectangle((70,410,1010,1240),radius=48,fill='white',outline='#E1EAF0',width=3)
  label(im,'ARECIBO LAB',225,44,'#116487');label(im,'PUEDE VARIAR',495,60,'#152636')
  # Clock with rotating hand; settled information stays readable.
  cx,cy=540,760;r=105;d.ellipse((cx-r,cy-r,cx+r,cy+r),outline='#9CE608',width=12)
  a=-math.pi/2+min(t/.8,1)*math.pi*.7;d.line((cx,cy,cx+math.cos(a)*75,cy+math.sin(a)*75),fill='#116487',width=10);d.line((cx,cy,cx-42,cy-34),fill='#116487',width=10);d.ellipse((cx-9,cy-9,cx+9,cy+9),fill='#116487')
  label(im,'15 MIN',925,150,'#152636')
  if t>=1.4:
   label(im,'A MEDIA HORA',1118,70,'#116487')
  enc.stdin.write(im.tobytes())
 enc.stdin.close();assert enc.wait()==0
print('Private-screen proxy and animated card ready.')
