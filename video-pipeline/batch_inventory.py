import json,os,subprocess,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent
files=list(Path('/Users/ericperez/Downloads').glob('*.MP4'))
all=[]
for idea in json.load(open(R/'runs/catalog.json'))['ideas'][:9]:
 if idea['title']=='area de juego':continue
 for v in idea['videos']:
  p=R/'media'/f"{v['id']}.mp4";hits=[f for f in files if f.stat().st_size==v['size_bytes']]
  if not p.exists() and len(hits)==1:os.link(hits[0],p)
  if not p.exists():continue
  meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]))
  record={'video':v,'idea':{k:idea[k] for k in ['id','title','hook']},'metadata':meta,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
  Path(str(p)+'.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
  all.append({'id':v['id'],'title':idea['title'],'idea_id':idea['id'],'source':str(p),'duration':float(meta['format']['duration'])})
(R/'runs/pending-inventory.json').write_text(json.dumps(all,ensure_ascii=False,indent=2))
for row in all:print(row['id'][:8],row['title'],row['duration'])
