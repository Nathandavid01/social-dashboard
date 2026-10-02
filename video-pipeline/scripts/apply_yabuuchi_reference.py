from pathlib import Path
import json,subprocess,sys
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
G=R/'media/yabuuchi/graphics';G.mkdir(exist_ok=True)
s=json.load(open(R/'styles/yabuuchi.json'));s.update(font_size=54,bottom_margin=300,outline=1,shadow=3,wrap_width=900,reference='media/yabuuchi/brand/primary-edit-reference.mp4',status='matched_visually_pending_audio_review');s['notes']=['Referencia principal: video 1.2.mp4 aportado por Eric el 2026-09-20. Prevalece sobre el ejemplo anterior.','Frases blancas en negrita, mayúsculas/minúsculas naturales, sombra gris, tamaño fijo aproximado 54px y zona baja, sin cubrir ojos.','Acercamientos suaves, B-roll pertinente, gráficas pequeñas al nombrar conceptos, pop/whoosh contenidos.','Efectos originales sintetizados: similitud auditiva exacta pendiente. Música CC0 seleccionada; no se afirma identidad de pista.'];(R/'styles/yabuuchi-reference.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
feedback={'reference':'media/yabuuchi/brand/primary-edit-reference.mp4','scope':'Yabuuchi Sushi, lote reciente Toa Baja','user_request':'Utilizar este editaje para captions, sonidos, B-roll y gráficas.','rules':s['notes'],'preserve':'Subtítulos nunca sobre los ojos. Originales y versiones anteriores conservados.'};(R/'styles/yabuuchi-feedback.json').write_text(json.dumps(feedback,ensure_ascii=False,indent=2))
font=ImageFont.truetype(str(R/'media/yabuuchi/brand/Arial-Bold.ttf'),70)
for kind in ['pin','car','sushi2','people2','years']:
 im=Image.new('RGBA',(280,250));d=ImageDraw.Draw(im);ink=(7,25,22,245)
 if kind=='pin':
  d.ellipse((55,10,225,180),fill=ink);d.polygon([(70,135),(140,240),(210,135)],fill=ink);d.ellipse((109,64,171,126),fill=(255,255,255,255))
 elif kind=='car':
  d.rounded_rectangle((20,100,260,185),20,fill=ink);d.polygon([(55,110),(82,50),(204,50),(235,110)],fill=ink);d.polygon([(84,95),(100,67),(188,67),(206,95)],fill=(255,255,255,235));d.ellipse((47,160,98,211),fill=ink);d.ellipse((185,160,236,211),fill=ink);d.ellipse((43,123,67,147),fill=(255,255,255,245));d.ellipse((212,123,236,147),fill=(255,255,255,245))
 elif kind=='sushi2':
  for x,y in [(20,30),(115,105)]:
   d.rounded_rectangle((x,y+20,x+125,y+105),22,fill=ink);d.ellipse((x,y,x+125,y+62),fill=ink);d.ellipse((x+10,y+10,x+115,y+52),fill=(255,255,255,245));d.ellipse((x+35,y+17,x+90,y+44),fill=ink)
 elif kind=='people2':
  for x in [15,150]:d.ellipse((x+20,25,x+95,100),fill=ink);d.rounded_rectangle((x,110,x+115,225),35,fill=ink)
 else:
  d.rounded_rectangle((20,20,260,230),22,fill=(255,255,255,245),outline=ink,width=4);d.text((140,96),'14',font=ImageFont.truetype(str(R/'media/yabuuchi/brand/Arial-Bold.ttf'),100),fill=ink,anchor='mm');d.text((140,185),'AÑOS',font=ImageFont.truetype(str(R/'media/yabuuchi/brand/Arial-Bold.ttf'),40),fill=ink,anchor='mm')
 im.save(G/(kind+'.png'))
placements={'quiero-dos':('sushi2',5.42,6.6,90,1220),'la-baby':('people2',5.83,7.25,90,1160),'toa-baja':('car',5.30,7.72,90,1160),'historia':('years',9.78,11.84,70,1130)}
outro=R/'media/yabuuchi/brand/reference-outro.mp4'
if not outro.exists():subprocess.run([F,'-v','error','-ss','14.577','-i',str(R/'media/yabuuchi/brand/primary-edit-reference.mp4'),'-t','3','-c:v','libx264','-crf','18','-c:a','aac','-b:a','256k',str(outro)],check=True)
for e in sorted((R/'edits').glob('yabuuchi-*-v1.json')):
 edit=json.load(open(e));slug=edit['idea_id'];duration=edit['clips'][0]['out'];edit['style']='../styles/yabuuchi-reference.json'
 edit['references']['primary_edit_reference']='media/yabuuchi/brand/primary-edit-reference.mp4';edit['references']['outro']='media/yabuuchi/brand/reference-outro.mp4';edit['outro']['source']='../media/yabuuchi/brand/reference-outro.mp4';edit['outro']['out']=2.99;edit['outro']['gain']=1
 edit['sounds']=[]
 for br in edit.get('broll',[]):
  for t in [br['at'],br['at']+br['out']-br['in']]:
   if t<duration-.2:edit['sounds'].append({'preset':'whoosh_soft','time':round(t,3),'duration':.18,'gain_db':-29})
 if slug in placements:
  kind,a,b,x,y=placements[slug];original=(e.parent/edit['source']).resolve();dest=original.with_name(slug+'-reference-graphic-v2.mp4');png=G/(kind+'.png')
  if not dest.exists():
   # Transparent local artwork, entering horizontally like the small icon in the reference.
   expr=f"if(lt(t,{a+.18}),{x}-320*(1-(t-{a})/.18),{x})"
   flt=f"[1:v]format=rgba[icon];[0:v][icon]overlay=x='{expr}':y={y}:enable='between(t,{a},{b})':eof_action=repeat[v]"
   subprocess.run([F,'-v','error','-i',str(original),'-i',str(png),'-filter_complex',flt,'-map','[v]','-map','0:a:0','-c:v','libx264','-preset','ultrafast','-crf','18','-threads','4','-c:a','copy',str(dest)],check=True)
  edit['source']='../'+str(dest.relative_to(R));edit['graphics']=[{'source':str(png.relative_to(R)),'start':a,'end':b,'original_source':str(original.relative_to(R)),'kind':'original_vector_graphic','reason':'Gráfica pequeña y semántica según video 1.2.mp4, bajo el rostro y sobre captions.'}];edit['references']['graphic']=str(png.relative_to(R));edit['sounds'].append({'preset':'pop','time':a,'duration':.13,'gain_db':-26})
 # Gentle opening approach. Keep graphics and rapid multi-person montage steady.
 if slug not in placements and slug!='elige-tu-favorito':edit['effects']=[{'preset':'soft_zoom','time':0,'duration':min(2.0,duration),'intensity':.18}]
 if slug=='elige-tu-favorito':
  t=0
  for part in edit['source_parts'][:-1]:
   t+=part['out']-part['in'];edit['sounds'].append({'preset':'swipe','time':round(t,3),'duration':.13,'gain_db':-32})
 edit['review_notes']+=['V2: referencia principal del usuario video 1.2.mp4; captions 54px bajos con sombra; apoyos, acercamientos y efectos contenidos; cierre extraído de la referencia.','No se afirma coincidencia auditiva exacta.']
 (e.parent/(e.stem.replace('-v1','-v2')+'.json')).write_text(json.dumps(edit,ensure_ascii=False,indent=2));print('READY V2',slug,flush=True)
