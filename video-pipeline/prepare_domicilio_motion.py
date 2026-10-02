from pathlib import Path
import subprocess,json,math
import cv2
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent; F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
src=R/'media/arecibo/DJI_20260909092001_0274_D.MP4'
# Original presenter remains visible. These symbols are illustrative motion graphics.
events=[(4.35,1.25,'home'),(6.06,1.48,'bed'),(8.30,1.30,'building'),(10.05,1.55,'petri'),(12.60,1.65,'cup')]
out=R/'media/arecibo/domicilio-motion-v3.mp4'
dec=subprocess.Popen([F,'-v','error','-ss','2.92','-t','14.48','-i',str(src),'-vf','scale=720:1280,fps=30','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
enc=subprocess.Popen([F,'-v','error','-n','-f','rawvideo','-pix_fmt','rgb24','-s','720x1280','-r','30','-i','-','-an','-c:v','libx264','-crf','16','-preset','fast','-threads','3','-pix_fmt','yuv420p',str(out)],stdin=subprocess.PIPE)
n=0
while True:
 b=dec.stdout.read(720*1280*3)
 if len(b)!=720*1280*3:break
 im=Image.frombytes('RGB',(720,1280),b).convert('RGBA');t=n/30
 for start,dur,kind in events:
  u=t-start
  if not 0<=u<dur:continue
  alpha=min(1,u/.18,(dur-u)/.18);alpha=alpha*alpha*(3-2*alpha)
  layer=Image.new('RGBA',(280,280));d=ImageDraw.Draw(layer);green='#9CE608';white='#F5FAFC'
  d.rounded_rectangle((10,10,270,270),radius=54,fill=(12,35,48,245),outline=(110,155,169,220),width=2)
  if kind=='home':
   d.line([(57,126),(140,57),(223,126)],fill=green,width=10);d.line([(75,120),(75,219),(205,219),(205,120)],fill=white,width=8);d.rectangle((119,161,160,219),outline=green,width=7)
  elif kind=='bed':
   d.line([(51,110),(51,225)],fill=green,width=8);d.line([(229,147),(229,225)],fill=green,width=8);d.line([(51,202),(229,202)],fill=white,width=9);d.ellipse((70,125,104,159),outline=white,width=6);d.rounded_rectangle((108,145,223,186),radius=12,outline=white,width=7)
  elif kind=='building':
   d.rounded_rectangle((70,60,210,222),radius=8,outline=white,width=7)
   for x in [94,154]:
    for y in [89,137]:d.rectangle((x,y,x+28,y+24),fill=green)
   d.rectangle((123,183,157,222),outline=green,width=6)
  elif kind=='petri':
   d.ellipse((57,63,224,224),outline=white,width=8);d.arc((72,83,210,214),10,165,fill=green,width=7)
   for x,y in [(110,110),(163,140),(106,177),(182,100)]:d.ellipse((x-7,y-7,x+7,y+7),fill=green)
  else:
   d.rounded_rectangle((91,86,190,222),radius=12,outline=white,width=7);d.rounded_rectangle((81,61,200,87),radius=8,fill=green);d.line((100,170,181,170),fill=green,width=7);d.rectangle((120,111,164,143),outline=white,width=4)
  size=round(190+18*alpha);layer=layer.resize((size,size),Image.Resampling.LANCZOS);layer.putalpha(layer.getchannel('A').point(lambda a:round(a*alpha)));im.alpha_composite(layer,(round(360-size/2),round(650+18*(1-alpha))))
 enc.stdin.write(im.convert('RGB').tobytes());n+=1
enc.stdin.close();assert enc.wait()==0;assert dec.wait()==0
old=json.loads((R/'edits/arecibo-domicilio-0274-v1.json').read_text());old['clips']=[{'in':2.92,'out':17.4,'zoom':1}]
old['captions']=[dict(c,start=round(max(0,c['start']-1.42),2),end=round(c['end']-1.42,2)) for c in old['captions'] if c['end']>1.42]
old['broll']=[{'source':'../media/arecibo/domicilio-motion-v3.mp4','in':0,'out':14.48,'at':0,'kind':'brand_graphic','reason':'Original presenter composited with service-specific animated icons; no unrelated speaking B-roll.'},{'source':'../media/arecibo/DJI_20260909100150_0298_D.MP4','in':.3,'out':1.5,'at':0,'fade_out':.18,'reason':'Establish Arecibo Lab during opening question; unique exterior shot, not used to illustrate home visits.'}]
old['effects']=[{'preset':'soft_zoom','time':3.82,'duration':2,'intensity':.35},{'preset':'punch_zoom','time':6.06,'duration':.7,'intensity':.25}]
old['sounds']=[{'kind':'preset','preset':'mouse_click','time':s,'duration':.09,'gain_db':-16} for s,du,k in events]
old['sounds'] += [{'kind':'preset','preset':'whoosh_soft','time':1.02,'duration':.22,'gain_db':-25},{'kind':'preset','preset':'swipe','time':10.0,'duration':.18,'gain_db':-27}]
old['music']['source']='../media/music/arecibo-domicilio-bed-v2.wav';old['previous_version']='../runs/arecibo-domicilio-0274-v1.mp4';old['review_notes']=['V2: remove name and long opening pause; continuous question and answer retained.','One genuine establishing B-roll, five semantic animated icon inserts with eased entrances/exits, controlled zooms and sound accents.','No local home-visit footage; do not misrepresent office or waiting room as patient homes.','Critical listening and user review pending.']
(R/'edits/arecibo-domicilio-0274-v3.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
