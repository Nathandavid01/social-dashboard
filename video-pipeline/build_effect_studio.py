import json,html,subprocess,wave,array
from pathlib import Path
from effects import PRESETS,SOUNDS,VISUALS,sound_samples,visual_filter
R=Path(__file__).resolve().parent;O=R/'runs/effects';F='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
def build(source,start):
 source=source.resolve();O.mkdir(exist_ok=True)
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(source)]))
 if start<0 or start+3>float(meta['format']['duration']):raise ValueError('La muestra requiere 3 segundos desde --start')
 base=O/'sample.mp4'
 subprocess.run([F,'-v','error','-y','-ss',str(start),'-i',str(source),'-t','3','-an','-vf','scale=540:960:force_original_aspect_ratio=increase,crop=540:960','-r','30','-c:v','libx264','-preset','ultrafast','-crf','24',str(base)],check=True)
 cards=[]
 for key,m in PRESETS.items():
  e={'preset':key,'time':.7,'duration':m['duration']}
  if key in SOUNDS:
   dest=O/(key+'.wav');data=[0]*9600+sound_samples(e)+[0]*9600
   with wave.open(str(dest),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(array.array('h',data).tobytes())
   player=f'<div class="sound-icon">♪</div><audio controls preload="none" src="{key}.wav"></audio>'
  else:
   dest=O/(key+'.mp4');vf=visual_filter(e)+',scale=360:640'
   subprocess.run([F,'-v','error','-y','-i',str(base),'-vf',vf,'-an','-t','3','-c:v','libx264','-preset','ultrafast','-crf','24',str(dest)],check=True)
   # Every preview must decode before it is exposed in the studio.
   subprocess.run([F,'-v','error','-i',str(dest),'-f','null','-'],check=True)
   player=f'<video controls playsinline preload="metadata" src="{key}.mp4"></video>'
  category='Sonido' if key in SOUNDS else ('Transición' if m['category']=='transition' else 'Efecto')
  cards.append(f'<article data-category="{m["category"]}">{player}<div class="card-copy"><small>{category} · {m["duration"]} s</small><h3>{html.escape(m["label"])}</h3><button class="choose" data-preset="{key}">Elegir</button></div></article>')
 # Actual alpha dissolve demo, from a brand card to the sampled footage.
 vf="[0:v]format=yuv420p[base];[1:v]fps=30,scale=540:960:force_original_aspect_ratio=increase,crop=540:960,format=yuva420p,fade=t=in:st=0.8:d=0.45:alpha=1,fade=t=out:st=2.3:d=0.45:alpha=1[top];[base][top]overlay=eof_action=pass:shortest=1,scale=360:640[v]"
 subprocess.run([F,'-v','error','-y','-f','lavfi','-i','color=c=0xb40083:s=540x960:r=30:d=3','-i',str(base),'-filter_complex',vf,'-map','[v]','-an','-t','3','-c:v','libx264','-preset','ultrafast',str(O/'dissolve.mp4')],check=True)
 cards.append('<article data-category="transition"><video controls playsinline preload="metadata" src="dissolve.mp4"></video><div class="card-copy"><small>Transición Entre Capas</small><h3>Fundido De B-roll</h3><button class="choose" data-preset="broll_dissolve">Elegir</button></div></article>')
 template=(R/'effect_studio.html').read_text();template=template.replace('__CARDS__',''.join(cards)).replace('__PRESETS__',json.dumps(PRESETS,ensure_ascii=False));(O/'index.html').write_text(template)
 (O/'manifest.json').write_text(json.dumps({'presets':PRESETS,'sound_origin':'Síntesis procedural original; sin muestras de terceros.','sample_source':str(source),'sample_start':start,'status':'local_preview','critical_listening':'pending'},ensure_ascii=False,indent=2))
 print('Laboratorio: http://127.0.0.1:3046/effects/index.html')
