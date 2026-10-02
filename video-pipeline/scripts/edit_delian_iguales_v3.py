from pathlib import Path
import json,hashlib,shutil,subprocess
import pipeline
root=Path('/Volumes/Extreme SSD/Nate Media/delian-iguales-v3');root.mkdir(exist_ok=True)
img=root/'ocho-sonrisas.png';shutil.copyfile('/Users/ericperez/.codex/generated_images/01a0d0d0-e473-7ad3-81c4-dd92ddf421ed/exec-000bb854-fe9b-496e-934f-1c31b8dec12b.png',img)
from PIL import Image
w,h=Image.open(img).size
filters=['[0:v]split=8'+''.join(f'[s{i}]' for i in range(8))]
for i in range(8):
 x=(i%2)*(w//2);y=(i//2)*(h//4)
 filters.append(f"[s{i}]crop={w//2-8}:{h//4-8}:{x+4}:{y+4},scale=1008:640:force_original_aspect_ratio=increase,crop=1008:640,zoompan=z='1+0.025*(3*pow(on/56,2)-2*pow(on/56,3))':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=57:s=504x320:fps=30[t{i}]")
layout='|'.join(f'{28+(i%2)*520}_{[100,440,780,1480][i//2]}' for i in range(8))
filters.append(''.join(f'[t{i}]' for i in range(8))+f'xstack=inputs=8:layout={layout}:fill=0x190e22,pad=1080:1920:0:0:color=0x190e22,format=yuv420p[out]')
subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg','-v','error','-n','-i',str(img),'-filter_complex',';'.join(filters),'-map','[out]','-an','-c:v','libx264','-crf','17','-preset','fast','-movflags','+faststart',str(root/'mosaico-sonrisas.mp4')],check=True)
p={'type':'ai_generated_editorial_image','source':str(img),'sha256':hashlib.sha256(img.read_bytes()).hexdigest(),'reserved_for':'sonrisas-iguales-20260921','created':'2026-09-24','description':'Ocho sonrisas distintas en mosaico animado; generación conceptual, no pacientes ni resultados reales de DML. Seis arriba y dos abajo con espacio reservado para subtítulos.','user_request':'necesito que se vean muchas sonrisas en este broll','tool':'image_gen','source_generated_path':'/Users/ericperez/.codex/generated_images/01a0d0d0-e473-7ad3-81c4-dd92ddf421ed/exec-000bb854-fe9b-496e-934f-1c31b8dec12b.png'}
(root/'asset-provenance.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n')
r=json.loads(Path('edits/delian-sonrisas-iguales-20260921-v2.json').read_text())
r['broll'][0].update(source=str(root/'mosaico-sonrisas.mp4'),reason='Ocho sonrisas distintas visibles simultáneamente durante pregunta; mosaico conceptual exclusivo con keyframes, no casos ni resultados de DML.',provenance=str(root/'asset-provenance.json'),asset_family='iguales-v3-ocho-sonrisas')
r['review_notes'][1]='v3: Eric pide muchas sonrisas en primer B-roll. Mosaico de ocho sonrisas generado exclusivamente, animación suave por celda y espacio para captions. Segundo apoyo conservado.'
recipe=Path('edits/delian-sonrisas-iguales-20260921-v3.json');assert not recipe.exists();recipe.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
shutil.copyfile('/Volumes/Extreme SSD/Nate Media/delian-iguales-v2/caption.txt',root/'caption.txt')
def cp(src,dst):
 with open(src,'rb') as a,open(dst,'xb') as b:shutil.copyfileobj(a,b)
pipeline.os.link=cp
pipeline.render(recipe,root/'delian-sonrisas-iguales-20260921-v3.mp4')
