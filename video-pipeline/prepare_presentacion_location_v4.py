"""Cinematic location inset from actual client footage; no invented map coordinates."""
from pathlib import Path
import json,math,subprocess
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
R=Path(__file__).resolve().parent;F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
SOURCE=R/'media/arecibo/DJI_20260909100214_0299_D.MP4'
DURATION=4.1;SOURCE_IN=2.7
font=lambda n:ImageFont.truetype(str(R/'media/arecibo/brand/Montserrat-Bold.ttf'),n)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)

def frame(photo,t):
 # Native-resolution type and a real moving façade in a dark photographic inset.
 W,H=952,448;panel=Image.new('RGBA',(W,H),'#0B1D28')
 w,h=photo.size;z=1+.035*ease(t/DURATION);cw=int(w/z);ch=int(cw/1.43);top=int(h*.255)
 crop=photo.crop(((w-cw)//2,top,(w+cw)//2,top+ch)).resize((640,H),Image.Resampling.LANCZOS).convert('RGBA')
 panel.alpha_composite(crop,(312,0))
 # Teal shadows and smooth photograph-to-type blend.
 a=np.zeros((H,W,4),dtype=np.uint8);a[:,:,:3]=[7,23,33]
 for x in range(W):a[:,x,3]=round(255*(1-ease((x-275)/360)))
 panel=Image.alpha_composite(panel,Image.fromarray(a))
 # restrained light sweep on entry; no flash
 light=Image.new('RGBA',(W,H));d=ImageDraw.Draw(light)
 d.line((2,1,W-3,1),fill=(156,230,8,180),width=2)
 d.line((1,2,1,H-3),fill=(104,155,174,180),width=1)
 d.line((W-2,2,W-2,H-3),fill=(207,232,241,140),width=1)
 d.line((2,H-2,W-3,H-2),fill=(80,110,124,150),width=1)
 panel=Image.alpha_composite(panel,light)
 # Editorial lower third. Small locator marker becomes a tracing line.
 labels=Image.new('RGBA',(W,H));d=ImageDraw.Draw(labels)
 ta=ease((t-.18)/.38);tx=int(32*(1-ta));white=(246,249,250,255)
 d.ellipse((38+tx,47,49+tx,58),fill='#9CE608');d.text((65+tx,39),'ARECIBO LAB',font=font(22),fill='#B3D67B')
 d.text((35+tx,102),'BARRIO',font=font(59),fill=white);d.text((32+tx,168),'FACTOR',font=font(73),fill=white)
 d.text((38+tx,286),'ARECIBO',font=font(27),fill='#D2E0E7');d.text((38+tx,324),'PUERTO RICO',font=font(19),fill='#8DABB8')
 line_end=40+int(220*ease((t-.3)/.7));d.line((40,390,line_end,390),fill='#9CE608',width=3)
 labels.putalpha(labels.getchannel('A').point(lambda v:round(v*ta)));panel=Image.alpha_composite(panel,labels)
 # Subtle corner registration marks; architectural, no UI pin.
 d=ImageDraw.Draw(panel)
 for x,y,dx,dy in [(W-30,30,-1,1),(W-30,H-30,-1,-1)]:
  d.line((x+dx*15,y,x,y,x,y+dy*15),fill='#D1E0E2',width=1)
 # Full entrance and exit, plus parallax in the live photograph.
 ent=ease(t/.4);ex=ease((t-(DURATION-.32))/.32);opacity=ent*(1-ex)
 scale=.955+.045*ent-.015*ex
 sw,sh=round(W*scale),round(H*scale);panel=panel.resize((sw,sh),Image.Resampling.LANCZOS)
 panel.putalpha(panel.getchannel('A').point(lambda v:round(v*opacity)))
 out=Image.new('RGBA',(1080,1920));x=(1080-sw)//2;y=round(852+sh*.02+30*(1-ent)+18*ex)
 shadow=Image.new('RGBA',out.size);sd=ImageDraw.Draw(shadow);sd.rectangle((x,y+14,x+sw,y+sh+14),fill=(0,0,0,round(110*opacity)));out=Image.alpha_composite(out,shadow.filter(ImageFilter.GaussianBlur(18)));out.alpha_composite(panel,(x,y))
 return out

if __name__=='__main__':
 out=R/'media/arecibo/presentacion-location-v4.mov'
 c=cv2.VideoCapture(str(SOURCE));c.set(cv2.CAP_PROP_POS_MSEC,SOURCE_IN*1000)
 enc=subprocess.Popen([F,'-v','error','-n','-f','rawvideo','-pix_fmt','rgba','-s','1080x1920','-r','30','-i','-','-an','-c:v','qtrle',str(out)],stdin=subprocess.PIPE)
 for n in range(round(DURATION*30)):
  c.set(cv2.CAP_PROP_POS_MSEC,(SOURCE_IN+n/30)*1000);ok,bgr=c.read()
  if not ok:raise ValueError('Source too short')
  im=frame(Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)),n/30)
  if n==48:im.save(R/'runs/arecibo-location-v4-overlay.png')
  enc.stdin.write(im.tobytes())
 enc.stdin.close();assert enc.wait()==0;c.release()
 p=R/'edits/arecibo-presentacion-0278-v3.json';edit=json.loads(p.read_text());edit['broll'][0]['out']=6.65
 edit['broll'].append({'source':'../media/arecibo/presentacion-location-v4.mov','in':0,'out':4.1,'at':9.47,'kind':'brand_graphic','original_source':str(SOURCE.relative_to(R)),'source_in':2.7,'source_out':6.8,'reason':'Real façade in cinematic photographic location inset; no fictional map. Presenter and captions remain clear.'})
 edit['sounds']=[s for s in edit['sounds'] if s['time']<9]
 edit['sounds'] += [{'kind':'preset','preset':'whoosh_soft','time':9.47,'duration':.32,'gain_db':-25},{'kind':'preset','preset':'mouse_click','time':9.89,'duration':.09,'gain_db':-21},{'kind':'preset','preset':'swipe','time':13.20,'duration':.23,'gain_db':-27}]
 edit['previous_version']='../runs/arecibo-presentacion-0278-v3.mp4';edit['review_notes']+=['v4 location: photographic architectural inset using actual façade0299 2.7–6.8s, cinematic title, restrained depth, smooth entrance/exit and gentle audio cues. No fabricated geographic claims.']
 (R/'edits/arecibo-presentacion-0278-v4.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2))
