import json,subprocess,sys,copy
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from pipeline import cut_words
F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
D=R/'media/yabuuchi/derived';D.mkdir(exist_ok=True)
def src(c):return next((R/'media/yabuuchi/source').glob('*_'+c+'_D.MP4'))
def caps(c,rows):return [{'source':c,'start':a,'end':b,'text':t} for a,b,t in rows]
items=[]
def add(slug,title,parts,cc,music='Be Chillin',broll=None,notes=None):items.append(dict(slug=slug,title=title,parts=parts,captions=cc,music=music,broll=broll or [],notes=notes or []))
add('sin-pescado-crudo','¿Sushi Sin Pescado Crudo?',[('0984',1.10,11.55)],caps('0984',[(1.18,2.8,'Chef, ¿el sushi siempre tiene que llevar'),(2.8,3.56,'pescado crudo?'),(3.64,5.96,'No. Tenemos variedad de churrasco con amarillo.'),(6,8.82,'Al igual tenemos los onigiris de pollo'),(8.82,11.42,'y tenemos igualmente dumplings de pollo.')]),notes=['Revisar por escucha nombre dumplings en la última frase.'])
add('primer-sushi','Tu Primer Sushi',[('0985',1.12,11.36)],caps('0985',[(1.14,3.6,'Oye, Alondra, si fuera mi primera vez probando el sushi,'),(3.84,4.78,'¿qué tú me recomendarías?'),(4.98,6.56,'Yo te diría que el Churrasco Roll.'),(6.62,8.48,'El que lleva churrasco, queso crema, cebollín,'),(8.58,10.02,'arriba amarillito y salsa anguila.'),(10.4,11.3,'Perfecto, dame uno de esos.')]),broll=[('0991',.3,3.55,5.5,'Plano del Churrasco Roll cuando enumera ingredientes.')])
add('churrasco-roll','Así Se Prepara El Churrasco Roll',[('0986',1.20,7.17),('0986',10.10,16.60)],caps('0986',[(1.24,3.04,'Por aquí vamos a estar preparando'),(3.04,4.28,'el Churrasco Roll,'),(4.36,7.08,'que es buenísimo para los principiantes.'),(10.10,11.00,'Vamos por aquí, va a llevar'),(11,12.76,'queso crema, cebollín,'),(13.08,15.30,'churrasco y amarillito por encima.'),(15.42,16.54,'Todo hecho al momento.')]),music='Backbeat')
add('historia','¿Por Qué Yabuuchi?',[('0004',1.44,13.40)],caps('0004',[(1.48,2.70,'Cuéntame, ¿por qué Yabuuchi?'),(2.94,4.62,'Pues mira, nuestro nombre es Yabuuchi'),(4.64,5.72,'en honor a Keiko Yabuuchi,'),(5.74,8.60,'quien fue la mujer pionera en sushi aquí en Puerto Rico,'),(8.68,9.94,'quien le enseñó a Carlos Santiago,'),(10.04,10.86,'el dueño de la marca,'),(11.20,13.30,'durante 14 años el arte de hacer sushi.')]),notes=['Historia y nombres conservados como testimonio de la persona grabada; revisión del cliente pendiente.'])
add('quiero-dos','Aprende A Decir Que No',[('0006',.70,7.40)],caps('0006',[(.76,2.72,'Tenemos que aprender a decir que no.'),(2.88,4.30,'Si la mesera viene y dice:'),(4.86,5.82,'¿Quieres un rollo?'),(6.16,7.28,'No. ¡Quiero dos!')]),music='Downtown Boogie')
add('otro-rollo','¿Y Si Pedimos Otro Rollo?',[('0007',1.23,5.78)],caps('0007',[(1.28,2.18,'¿Quieres otro rollo?'),(2.36,3.26,'No tenemos tiempo.'),(3.42,4.10,'¿Tiempo pa’ qué?'),(4.42,5.62,'Para preguntas innecesarias.')]),music='Downtown Boogie',notes=['Última frase corregida según el guion local; requiere escucha final porque ambos reconocedores discrepan.'])
add('elige-tu-favorito','Elige Tu Favorito',[('0008',.62,3.48),('0010',.62,2.96),('0012',1.02,5.58),('0013',.52,2.86),('0014',0,3.49),('0017',1.06,6.90)],caps('0008',[(.66,2.66,'¿Cuál prefieres: el Borrachito o el Sushi Burrito?'),(2.72,3.42,'El Borrachito.')])+caps('0010',[(.66,2.18,'¿Qué prefieres: La Jefa o El Boss?'),(2.38,2.90,'La Jefa.')])+caps('0012',[(1.06,3.54,'¿Cuál prefieres: el cheesecake frito o el lava cake?'),(3.72,5.50,'El cheesecake frito con guayaba.')])+caps('0013',[(.56,2.04,'¿El crab rangoon o los dumplings?'),(2.22,2.80,'Los dumplings.')])+caps('0014',[(0,2.60,'¿Prefieres el lychee o el de strawberry?'),(2.78,3.42,'El de lychee.')])+caps('0017',[(1.1,2.22,'¿Onigiri o edamame?'),(2.36,2.90,'Edamame.'),(3.16,4.44,'¿Todo eso lo tienen aquí?'),(4.72,6.80,'Sí, aquí en la avenida Dos Palmas, Levittown.')]),music='Backbeat',notes=['Se omite 0011 por nombre de plato no confirmado. Revisar nombres de menú y escucha de preguntas.'])
add('toa-baja','Visítanos En Toa Baja',[('0018',0,7.89)],caps('0018',[(0,2.20,'Y por si no lo sabías,'),(2.40,3.84,'estamos en la avenida Dos Palmas,'),(3.88,4.64,'aquí en Levittown,'),(4.8,6.12,'y contamos con amplio estacionamiento'),(6.12,7.78,'al frente y atrás para los clientes.')]),notes=['Sin horario: las tomas 0019 y 0020 dicen horarios distintos.'])
add('la-baby','La Baby Para Dos',[('0023',.87,8.22)],caps('0023',[(.92,3.16,'Si tienen hambre tú y tu pareja de sushi,'),(3.40,4.68,'aquí en Yabuuchi Levittown'),(4.78,6.48,'tenemos la cajita de La Baby,'),(6.70,8.10,'que es perfecta para dos personas.')]),broll=[('0021',4,6.95,3.55,'Mostrar la caja real al nombrar La Baby; sin repetir planos del Churrasco Roll.')],notes=['Escucha pendiente de la primera frase.'])
add('calidad','¿Qué Hace Distinto A Yabuuchi?',[('0996',5.58,12.64)],caps('0996',[(5.62,7.08,'¿Qué hace que Yabuuchi sea distinto?'),(7.30,9.02,'Pues mira, la calidad de los productos,'),(9.22,10.58,'lo fresco de los ingredientes'),(10.58,12.56,'y sobre todo el enfoque en el servicio al cliente.')]),notes=['Última frase requiere cotejo auditivo.'])
catalog={'fetched_at':'2026-09-20','client_id':'0b870c21-70f0-44ad-8319-352e55cf377f','ideas':[{'id':i['slug'],'title':i['title'],'hook':i['captions'][0]['text']} for i in items]}
(R/'runs/yabuuchi-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
for item in items:
 slug=item['slug'];parts=item['parts'];total=0;words=[];cc=[]
 for c,a,b in parts:
  tr=json.load(open(next((R/'runs/yabuuchi-transcripts').glob('*_'+c+'_D.json'))));ww=[w for s in tr['segments'] for w in s.get('words',[])]
  mapped=cut_words(ww,[{'in':a,'out':b}])
  words.extend([{**w,'start':round(w['start']+total,3),'end':round(w['end']+total,3)} for w in mapped])
  for ca in item['captions']:
   if ca['source']==c and ca['start']>=a-.015 and ca['end']<=b+.015:
    cc.append({'start':round(max(0,ca['start']-a)+total,3),'end':round(min(b,ca['end'])-a+total,3),'text':ca['text']})
  total+=b-a
 trpath=R/'runs'/f'yabuuchi-{slug}-mapped.json';trpath.write_text(json.dumps({'segments':[{'words':words}]},ensure_ascii=False,indent=2))
 target=D/f'{slug}-source-v1.mp4'
 if not target.exists():
  args=[F,'-v','error','-y'];flt=[]
  for c,a,b in parts:args+=['-i',str(src(c))]
  for n,(c,a,b) in enumerate(parts):flt += [f'[{n}:v:0]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[v{n}]',f'[{n}:a:0]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a{n}]']
  flt+=[''.join(f'[v{n}][a{n}]' for n in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=1[v][a]']
  subprocess.run(args+['-filter_complex',';'.join(flt),'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','ultrafast','-threads','4','-c:a','aac','-b:a','256k',str(target)],check=True)
 music=R/'media/yabuuchi'/f'{slug}-music.wav'
 if not music.exists():subprocess.run([F,'-v','error','-y','-i',str(R/'media/music'/f"{item['music']}.mp3"),'-t',str(total),'-af',f'loudnorm=I=-29:TP=-9:LRA=7,afade=t=in:d=0.12,afade=t=out:st={max(0,total-.6)}:d=0.6','-ar','48000',str(music)],check=True)
 edit={'client_id':catalog['client_id'],'idea_id':slug,'catalog':'runs/yabuuchi-catalog.json','title':item['title'],'source':str(target.relative_to(R)).replace('media/','../media/',1),'transcript':'../runs/'+trpath.name,'style':'../styles/yabuuchi.json','clips':[{'in':0,'out':round(total,3),'zoom':1,'audio_edge_fade':.015}],'captions':cc,'outro':{'source':'../media/yabuuchi/brand/outro.mp4','in':0,'out':3,'gain':.5},'music':{'source':'../media/yabuuchi/'+music.name,'license':'CC0 1.0','provenance':'media/music/'+item['music']+'.provenance.json'},'broll':[{'source':'../media/yabuuchi/source/'+src(c).name,'in':a,'out':b,'at':at,'reason':why} for c,a,b,at,why in item['broll']],'source_parts':[{'source':str(src(c).relative_to(R)),'in':a,'out':b} for c,a,b in parts],'references':{'style_reference':'media/yabuuchi/brand/style-reference.mp4','outro':'media/yabuuchi/brand/outro.mp4'},'review_notes':item['notes']+['Fuente Arial Bold aproximada desde referencia disponible. Escucha crítica y aprobación del usuario pendientes.']}
 (R/'edits'/f'yabuuchi-{slug}-v1.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2))
 print('PREPARED',slug,round(total+3,2),flush=True)
(R/'runs/yabuuchi-batch-manifest.json').write_text(json.dumps({'status':'drafts_prepared','items':items,'held':[{'source':'0983','reason':'La explicación parece invertir nigiri y sashimi. Regrabar o confirmar antes de editar para publicación.'},{'source':'0019/0020','reason':'Horarios contradictorios. Se usa 0018 sin horario.'},{'source':'0998/0999/0001/0002','reason':'Alternativa para compartir; nombres de cajas pendientes de confirmar. La Baby tiene montaje propio.'},{'source':'0011','reason':'Nombre de plato no confirmado.'}]},ensure_ascii=False,indent=2))
