from pathlib import Path
import subprocess,json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from service_scenes import render
R=Path(__file__).resolve().parent;F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';src=R/'media/arecibo/DJI_20260909092001_0274_D.MP4';font=lambda sz:ImageFont.truetype(str(R/'media/arecibo/brand/Montserrat-Bold.ttf'),sz)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
events=[(.12,1.43,'home',''),(1.90,1.66,'bed','01'),(4.10,1.50,'center','02'),(5.80,1.75,'culture','03'),(8.38,1.87,'cup','04')]
dec=subprocess.Popen([F,'-v','error','-ss','6.98','-t','10.42','-i',str(src),'-vf','scale=1080:1920,fps=30','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
out=R/'media/arecibo/domicilio-pro-v5.mp4';enc=subprocess.Popen([F,'-v','error','-n','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','17','-preset','fast','-threads','3','-pix_fmt','yuv420p',str(out)],stdin=subprocess.PIPE)
n=0
while True:
 b=dec.stdout.read(1080*1920*3)
 if len(b)!=1080*1920*3:break
 im=Image.frombytes('RGB',(1080,1920),b).convert('RGBA');t=n/30
 if t<1.8:
  opacity=1-ease((t-1.5)/.3);grad=np.zeros((420,1080,4),dtype=np.uint8);grad[:,:,:3]=[9,33,46];grad[:,:,3]=np.uint8(np.linspace(230,0,420)[:,None]*opacity);im.alpha_composite(Image.fromarray(grad),(0,0))
  layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer)
  d.text((68,72),'ARECIBO LAB',font=font(30),fill=(156,230,8,round(255*opacity)))
  d.text((64,133),'EL LABORATORIO,',font=font(80),fill=(255,255,255,round(255*opacity)))
  d.text((64,229),'A TU LUGAR.',font=font(88),fill=(255,255,255,round(255*opacity)));im=Image.alpha_composite(im,layer)
 for start,dur,kind,number in events:
  u=t-start
  if not 0<=u<dur:continue
  ent=ease(u/.26);ex=ease((u-(dur-.23))/.23);alpha=ent*(1-ex)
  card=Image.new('RGBA',(956,280));d=ImageDraw.Draw(card);d.rounded_rectangle((0,0,955,279),radius=26,fill=(240,247,247,255));d.rounded_rectangle((0,0,9,279),radius=4,fill='#9CE608')
  if number:
   d.text((40,44),number,font=font(84),fill='#183F50');d.line((44,159,148,159),fill='#9CE608',width=5)
   for j in range(4):d.rounded_rectangle((44+j*25,183,61+j*25,188),radius=2,fill='#9CE608' if j<int(number) else '#CDDDDF')
  scene=render(kind,t,740,266);card.alpha_composite(scene,(176 if number else 95,4))
  card.putalpha(card.getchannel('A').point(lambda a:round(a*alpha)));x=round(62+28*(1-ent)+20*ex);y=round(1032+32*(1-ent)-14*ex)
  shadow=Image.new('RGBA',im.size);ImageDraw.Draw(shadow).rounded_rectangle((x,y+12,x+956,y+292),radius=26,fill=(0,0,0,round(60*alpha)));im=Image.alpha_composite(im,shadow.filter(ImageFilter.GaussianBlur(16)));im.alpha_composite(card,(x,y))
 enc.stdin.write(im.convert('RGB').tobytes());n+=1
enc.stdin.close();assert enc.wait()==0;assert dec.wait()==0
old=json.loads((R/'edits/arecibo-domicilio-0274-v1.json').read_text());old['clips']=[{'in':6.98,'out':17.4,'zoom':1}]
# Open on the recorded statement, removing the interviewer and dependent 'si'.
old['captions']=[dict(c,start=round(max(0,c['start']-5.48),2),end=round(c['end']-5.48,2),text='REALIZAMOS' if c['text']=='SÍ, REALIZAMOS' else c['text']) for c in old['captions'] if c['end']>5.48]
old['broll']=[{'source':'../media/arecibo/domicilio-pro-v5.mp4','in':0,'out':10.42,'at':0,'eof_action':'repeat','kind':'brand_graphic','reason':'Original presenter with dimensional service illustrations and redesigned opening; no stock or synthetic human footage.'}]
old['effects']=[];old['sounds']=[{'kind':'preset','preset':'mouse_click','time':s+.13,'duration':.09,'gain_db':-17} for s,du,k,num in events if num]
old['sounds'] += [{'kind':'preset','preset':'whoosh_soft','time':.12,'duration':.25,'gain_db':-25},{'kind':'preset','preset':'swipe','time':5.8,'duration':.16,'gain_db':-27}]
old['music']['source']='../media/music/arecibo-domicilio-bed-v4.wav';old['previous_version']='../runs/arecibo-domicilio-0274-v3.mp4';old['review_notes']=['V4: opens on actual statement Realizamos servicios a lugar; no exterior opening, interviewer, or dependent sí.','Dimensional orthographic illustrations with lighting, shadows, subtle camera motion and four numbered service panels replace small outline badges.','Caption font remains fixed Montserrat70. Original continuous voice 6.98–17.40, no invented medical claim.','Graphics only over original presenter; clinical scenes clearly illustrative. Critical listening and user approval pending.']
(R/'edits/arecibo-domicilio-0274-v5.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
