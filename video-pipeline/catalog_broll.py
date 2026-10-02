from pathlib import Path
import json,os,subprocess,hashlib
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;O=R/'runs/broll-catalog';O.mkdir(exist_ok=True)
vs=next(i for i in json.load(open(R/'runs/catalog.json'))['ideas'] if i['title']=='Broll')['videos']
fs=[p for p in Path('/Users/ericperez/Downloads').iterdir() if p.is_file() and p.suffix.lower()=='.mp4']
rows=[]
for n,v in enumerate(vs):
 p=R/'media'/(v['id']+'.mp4');hits=[f for f in fs if f.stat().st_size==v['size_bytes']]
 if not p.exists() and len(hits)==1:os.link(hits[0],p)
 if not p.exists():continue
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(p)]));d=float(meta['format']['duration']);ts=[round(.2+(d-.5)*j/5,2) for j in range(6)]
 sheet=O/f'{n+1:02}.jpg'
 if not sheet.exists():
  im=Image.new('RGB',(1080,344),'#211b25')
  for j,t in enumerate(ts):
   f=O/'temp.jpg';subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-vf','scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2','-y',str(f)],check=True)
   im.paste(Image.open(f),(j*180,0));ImageDraw.Draw(im).text((j*180,322),f'{n+1:02} | {t}s',fill='white')
  im.save(sheet)
 rows.append({'number':n+1,'id':v['id'],'source':str(p.relative_to(R)),'duration':d,'sample_times':ts,'sheet':str(sheet.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(O/'inventory.json').write_text(json.dumps(rows,indent=2))
for batch in range(7):
 group=[x for x in rows if batch*5<x['number']<=(batch+1)*5]
 if group:
  im=Image.new('RGB',(1080,344*len(group)))
  for j,x in enumerate(group):im.paste(Image.open(R/x['sheet']),(0,344*j))
  im.save(O/f'board-{batch+1}.jpg')
print('Available',len(rows),'of',len(vs),'numbers',[x['number'] for x in rows])
