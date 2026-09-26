from PIL import Image,ImageDraw,ImageFont,ImageFilter
import numpy as np
from pathlib import Path
p=Path('$WORKSPACE/output/reference-edit-20260926')
ref=Image.open(p/'caption-style-reference.png').convert('RGB')
canvas=Image.new('RGB',(512,98*4),'#102027');canvas.paste(ref,(0,0))
for idx,name in enumerate(['Tahoma','Arial','Arial Bold'],1):
 f=ImageFont.truetype('/System/Library/Fonts/Supplemental/'+name+'.ttf',120)
 m=Image.new('L',(1100,180));ImageDraw.Draw(m).text((10,0),'Nos fuimos viral',font=f,fill=255)
 m=m.crop(m.getbbox()).resize((425,43),Image.Resampling.LANCZOS)
 mask=Image.new('L',(512,98));mask.paste(m,(51,18))
 border=mask.filter(ImageFilter.MaxFilter(7));shadow=Image.new('L',(512,98));shadow.paste(border,(2,4));shadow=shadow.filter(ImageFilter.GaussianBlur(1.5))
 img=Image.new('RGBA',(512,98),(16,32,39,255));black=Image.new('RGBA',img.size,(0,0,0,0));black.putalpha(shadow);img=Image.alpha_composite(img,black)
 stroke=Image.new('RGBA',img.size,(115,115,115,255));stroke.putalpha(border);img=Image.alpha_composite(img,stroke)
 grad=Image.new('RGBA',img.size)
 dr=ImageDraw.Draw(grad)
 for y in range(98):
  v=round(255-65*max(0,min(1,(y-42)/19)));dr.line((0,y,512,y),fill=(v,v,v,255))
 grad.putalpha(mask);img=Image.alpha_composite(img,grad)
 canvas.paste(img.convert('RGB'),(0,idx*98))
canvas.save(p/'caption-font-comparison.png')
