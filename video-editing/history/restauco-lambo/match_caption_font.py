from PIL import Image,ImageFont,ImageDraw
import numpy as np
from pathlib import Path
p=Path('$WORKSPACE/output/reference-edit-20260926')
im=np.asarray(Image.open(p/'caption-style-reference.png').convert('RGB'))
ys=np.arange(im.shape[0])[:,None]; threshold=np.where(ys<43,210,210-(ys-43)*3.1); mask=((im.min(axis=2)>threshold)&(ys<63)&(ys>15)).astype('uint8')*255
ref=Image.fromarray(mask); box=ref.getbbox();ref=ref.crop(box);print('core bounds',box)
a=np.asarray(ref)>0
candidates=[]
paths=list(Path('/System/Library/Fonts/Supplemental').glob('*.ttf'))
paths +=[Path('/System/Library/Fonts')/n for n in ['Helvetica.ttc','HelveticaNeue.ttc','Avenir.ttc','Avenir Next.ttc','SFNS.ttf']]
for path in paths:
 for index in range(20 if path.suffix=='.ttc' else 1):
  try:f=ImageFont.truetype(str(path),120,index=index)
  except:break
  canvas=Image.new('L',(2000,240));ImageDraw.Draw(canvas).text((5,0),'Nos fuimos viral',font=f,fill=255)
  canvas=canvas.crop(canvas.getbbox()).resize(ref.size,Image.Resampling.LANCZOS)
  b=np.asarray(canvas)>165
  score=np.logical_and(a,b).sum()/np.logical_or(a,b).sum()
  candidates.append((score,str(path),index,f.getname()))
for row in sorted(candidates,reverse=True)[:15]:print(row)
