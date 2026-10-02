import json,hashlib,html,subprocess,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1];r=R/'runs';d=r/'delian-sept-enriched';plan=json.loads((d/'render-plan.json').read_text());m=json.loads((r/'delian-sept-five.json').read_text());oldh=(r/'delian-sept-five.html').read_text();shutil.copy2(r/'delian-sept-five.json',d/'previous-manifest.json');shutil.copy2(r/'delian-sept-five.html',d/'previous-gallery.html')
notes=['Carillas ilustrativas animadas; barrido y transiciones con sonido.','Encerado ilustrativo animado durante la explicación del mock-up.','B-roll real frente al espejo y transiciones por etapas.','Guía de color ilustrativa animada al hablar del tono dental.','B-roll de visita clínica con entrada y salida sonorizadas.']
verified=[];cards=[]
for i,(x,note) in enumerate(zip(plan,notes)):
 v=Path(x['video']);review=json.loads(v.with_suffix('.review.json').read_text());a=json.loads(v.with_suffix('.audio.json').read_text());assert a['status']=='pass';assert all(n['status']=='pass' for n in review['nodes'] if n['id'] in ['render','technical_check','audio_master'])
 duration=float(json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-of','json',str(v)]))['format']['duration']);spec=json.loads(Path(x['edit']).read_text());assert spec['effects'] and spec['sounds'] and spec['broll'] and spec['music']
 m['videos'][i].update(video=v.name,duration=duration,review=v.with_suffix('.review.json').name,previous=x['previous'])
 cards.append(f'<article><small>VIDEO {i+1} · {duration:.1f} s</small><h2>{html.escape(x["title"])}</h2><video id="v{i}" controls playsinline preload="metadata" src="{v.name}"></video><div class="links"><a download href="{v.name}">Descargar MP4</a><a href="{v.stem}.review.json">Ver revisión</a></div><p>{note}</p><small><a href="{x["previous"]}">Versión anterior</a></small></article>')
 verified.append({'video':v.name,'sha256':hashlib.sha256(v.read_bytes()).hexdigest(),'duration':duration,'technical':'pass','audio_master':'pass','effects':len(spec['effects']),'sounds':len(spec['sounds']),'broll':len(spec['broll']),'music_below_voice_lu':a['settings']['music_below_voice_lu'],'playback':'pending','critical_listening':'pending'})
start=oldh.index('<section class="grid">');end=oldh.index('</section>',start)+len('</section>');h=oldh[:start]+'<section class="grid">'+''.join(cards)+'</section>'+oldh[end:]
a=h.index('<h1>');b=h.index('<p><a href="delian-sept-library',a);h=h[:a]+'<h1>Cinco videos · nueva edición</h1><p>Transiciones visuales con sonidos sincronizados, B-roll de video y de imágenes animadas, música de fondo y cierre oficial. Las imágenes de carillas, encerado y guía de color son ilustrativas generadas; las tomas de la clínica son reales.</p>'+h[b:]
(r/'delian-sept-five.html').write_text(h);m['revision']='transition_image_broll_music_2026-09-23';(r/'delian-sept-five.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));(d/'verification.json').write_text(json.dumps({'videos':verified,'publication':'not_published'},ensure_ascii=False,indent=2))
cpath=r/'delian-sept-library/catalog.json';c=json.loads(cpath.read_text());A=R/'media/delian/broll-sept-enriched'
for i,name in [(0,'carillas'),(1,'encerado'),(3,'color')]:
 source=A/(name+'.png');dest=r/'delian-sept-library'/(name+'-ilustracion.mp4');shutil.copy2(A/(name+'-animated.mp4'),dest)
 c['shots'].append({'label':name.title()+' · Imagen Ilustrativa Animada','file':dest.name,'source':str(source),'type':'generated_educational_image','family':name,'audio':'none','used_in':[Path(plan[i]['video']).stem],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
c['shots'].append({'label':'Uso Real De Hilo Frente Al Espejo','source':'/Users/ericperez/Nate Media/delian-loyola-video/media/source-2026-08-10/DJI_20260810154449_0305_D.MP4','source_range':[2,4.2],'family':'hilo-espejo','audio':'muted','used_in':[Path(plan[2]['video']).stem]})
for s in c['shots']:
 if s.get('family')=='visita-clinica':s['used_in'].append(Path(plan[4]['video']).stem)
cpath.write_text(json.dumps(c,ensure_ascii=False,indent=2))
lib=r/'delian-sept-library/index.html';page=lib.read_text();extra=''.join(f'<article><h2>{name.title()} · Ilustración</h2><video controls src="{name}-ilustracion.mp4"></video><p>Imagen educativa generada y animada.</p></article>' for name in ['carillas','encerado','color']);lib.write_text(page.replace('</main>',extra+'</main>'))
print(json.dumps(verified,ensure_ascii=False,indent=2))
