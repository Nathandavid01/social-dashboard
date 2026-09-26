"""Evidence graph generated for every render. Editorial checks never auto-pass."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

def build(output):
 output=Path(output).resolve(); r=json.loads(output.with_suffix('.json').read_text());e=r['edit']
 catalog=json.loads((ROOT/e.get('catalog','runs/catalog.json')).read_text());idea=next((i for i in catalog['ideas'] if i['id']==e['idea_id']),None)
 refs=[{'role':role,'path':path,'exists':(ROOT/path).is_file(),'sha256':digest(ROOT/path) if (ROOT/path).is_file() else None} for role,path in ([(k,v) for k,v in e['references'].items()] if e.get('references') else [('instagram','media/reference/ref-video.mp4'),('instagram_audio','media/reference/ref-audio.mp4'),('brand_example','media/brand/style-reference.png'),('outro','media/brand/outro.mov'),('previous_example','runs/nanas-pregunta-v6.mp4')])+[('font',str(((ROOT/'edits'/e['style']).resolve().parent / r['style']['font_file']).resolve().relative_to(ROOT)))]]
 problems=[];caps=r['captions']
 for a,b in zip(caps,caps[1:]):
  if a['end']>b['start']+.015:problems.append('Subtítulos solapados')
 for c in caps:
  if c['end']-c['start']<.25:problems.append('Subtítulo inferior a 250 ms: '+c['text'])
 if not idea:problems.append('Idea no encontrada en catálogo')
 if not all(x['exists'] for x in refs):problems.append('Falta referencia o asset')
 if e.get('music') and not Path(e['music'].get('provenance','')).is_file():problems.append('Falta procedencia de música añadida')
 video=next(s for s in r['output']['streams'] if s['codec_type']=='video')
 if (video['width'],video['height'])!=(1080,1920):problems.append('Formato diferente a 1080 × 1920')
 board=output.with_name(output.stem+'-compare.jpg')
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(output),'-vf','fps=1,scale=216:384,tile=5x3','-frames:v','1',str(board)],check=True)
 graph={'version':1,'output':output.name,'output_sha256':digest(output),'idea':idea and {'title':idea['title'],'hook':idea['hook'],'catalog_date':catalog['fetched_at']},'references':refs,'comparison_board':board.name,'status':'changes_required' if problems else 'editorial_review_required','nodes':[{'id':'idea','status':'pass' if idea else 'fail'},{'id':'references','status':'pass' if all(x['exists'] for x in refs) else 'fail'},{'id':'render','status':'pass','full_decode':r['verification']['full_decode']},{'id':'technical_check','status':'fail' if problems else 'pass','findings':problems},{'id':'visual_comparison','status':'pending','criteria':['Gancho y relación con la idea','B-roll pertinente y continuidad','Fuente, color, tamaño, posición y ritmo frente a Instagram y ejemplo de carpeta','Outro oficial']},{'id':'audio_comparison','status':'pending','criteria':['Voz inteligible','Música y efectos frente al ejemplo; no afirmar identidad sin escuchar']},{'id':'user_review','status':'pending'},{'id':'revise','status':'conditional'}],'edges':[['idea','references'],['references','render'],['render','technical_check'],['technical_check','visual_comparison'],['visual_comparison','audio_comparison'],['audio_comparison','user_review'],['technical_check','revise'],['visual_comparison','revise'],['audio_comparison','revise'],['revise','render']],'policy':'Cada corrección crea una nueva versión; reabrir comparación tras cada render. Ninguna publicación automática.'}
 dest=output.with_suffix('.review.json');dest.write_text(json.dumps(graph,indent=2,ensure_ascii=False));print('Grafo de revisión: '+str(dest));return graph
if __name__=='__main__':build(sys.argv[1])
