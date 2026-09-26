from PIL import Image,ImageDraw,ImageFont,ImageFilter
scale=3
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
