from pathlib import Path
import json,subprocess,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageFilter
p=Path(__file__).resolve().parent;w=Path('$TMPDIR/restauco-caption-v5');w.mkdir(exist_ok=True)
e=json.loads((p/'pipeline/edits/v3.json').read_text());caps=e['captions'];scale=3
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Tahoma.ttf',72*scale)
def wrap(s):
 if font.getlength(s)<=890*scale:return [s]
 words=s.split();choices=[]
 for i in range(1,len(words)):
  a,b=' '.join(words[:i]),' '.join(words[i:]);wa,wb=font.getlength(a),font.getlength(b)
  if max(wa,wb)<=890*scale:choices.append((abs(wa-wb),[a,b]))
 return min(choices)[1] if choices else [s]
def line_mask(text):
 box=font.getbbox(text);im=Image.new('L',(box[2]-box[0]+20*scale,box[3]-box[1]+20*scale));ImageDraw.Draw(im).text((10*scale-box[0],10*scale-box[1]),text,font=font,fill=255)
 im=im.crop(im.getbbox());return im.resize((im.width,round(im.height*.93)),Image.Resampling.LANCZOS)
def make_caption(text,path):
 lines=[line for part in text.split('\n') for line in wrap(part)]
 masks=[line_mask(s) for s in lines];gap=17*scale
 heights=sum(m.height for m in masks)+gap*(len(masks)-1)
 canvas=Image.new('RGBA',(1080*scale,280*scale));y=250*scale-heights
 for m in masks:
  x=(canvas.width-m.width)//2
  full=Image.new('L',canvas.size);full.paste(m,(x,y))
  border=full.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(.25*scale))
  shadow=Image.new('L',canvas.size);shadow.paste(border,(round(2.4*scale),round(4.8*scale)));shadow=shadow.filter(ImageFilter.GaussianBlur(2.1*scale))
  layer=Image.new('RGBA',canvas.size,(0,0,0,255));layer.putalpha(shadow);canvas=Image.alpha_composite(canvas,layer)
  stroke=Image.new('RGBA',canvas.size,(113,113,113,255));stroke.putalpha(border);canvas=Image.alpha_composite(canvas,stroke)
  grad=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(grad)
  for row in range(m.height):
   v=round(255-66*max(0,min(1,(row/m.height-.54)/.46)))
   d.line((x,y+row,x+m.width,y+row),fill=(v,v,v,255))
  grad.putalpha(full);canvas=Image.alpha_composite(canvas,grad);y+=m.height+gap
 canvas.resize((1080,280),Image.Resampling.LANCZOS).save(path)
Image.new('RGBA',(1080,280)).save(w/'blank.png')
parts=[];prev=0
for i,c in enumerate(caps):
 a,b=round(c['start']*30),round(c['end']*30)
 if a>prev:parts.append(('blank.png',(a-prev)/30))
 name=f'caption-{i:02d}.png';make_caption(c['text'],w/name);parts.append((name,(b-a)/30));prev=b
parts.append(('blank.png',(1082-prev)/30))
manifest='ffconcat version 1.0\n'
for name,duration in parts:manifest+=f"file '{name}'\nduration {duration:.9f}\n"
manifest+="file 'blank.png'\n";(w/'captions.ffconcat').write_text(manifest)
ff='/opt/homebrew/bin/ffmpeg'
subprocess.run([ff,'-v','error','-y','-f','concat','-safe','0','-i',str(w/'captions.ffconcat'),'-vf','fps=30','-c:v','qtrle','-pix_fmt','argb',str(w/'captions.mov')],check=True)
source=e['source'];ref=e['references']['edited_example'];out=p/'Restauco-Lambo-VW-v5.mp4'
filters=';'.join([
'[0:v]trim=start=2.08:end=13.1,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[v0]',
'[0:v]trim=start=16.5:end=38.32,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[v1]',
'[v0][v1]concat=n=2:v=1:a=0[main]',
'[1:v]trim=start=50.6:end=53.8,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[tail]',
'[main][tail]concat=n=2:v=1:a=0[clean]',
'[clean][2:v]overlay=0:1255:eof_action=pass,format=yuv420p[v]'])
cmd=[ff,'-hide_banner','-n','-threads','2','-filter_complex_threads','2','-i',source,'-i',ref,'-i',str(w/'captions.mov'),'-i',str(p/'Restauco-Lambo-VW-v4.mp4'),'-filter_complex',filters,'-map','[v]','-map','3:a:0','-c:v','libx264','-preset','fast','-crf','19','-threads','4','-c:a','copy','-t','36.066667','-movflags','+faststart',str(out)]
with (p/'render-v5.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=log)
subprocess.run([ff,'-v','error','-i',str(out),'-f','null','-'],check=True)
report={'output':out.name,'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'full_decode':True,'font':'Tahoma Regular, 72px with 93% glyph-height scaling','fill':'white upper fill graduating to silver #bdbdbd at baseline','outline':'#717171, approximately 2.7px, antialiased','shadow':'black, soft 2.1px, offset 2.4px/4.8px','audio':'copied from v4 without re-encoding','captions':caps,'reference':'caption-style-reference.png','visual_review':'pending'}
(p/'Restauco-Lambo-VW-v5.review.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(out)
