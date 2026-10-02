import subprocess,sys,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
for e in sorted((R/'edits').glob('yabuuchi-*-v3.json')):
 out=R/'runs'/(e.stem+'.mp4')
 if out.exists():continue
 with (R/'runs'/(e.stem+'.render.log')).open('w') as f:
  r=subprocess.run([sys.executable,str(R/'pipeline.py'),'render',str(e),str(out)],stdout=f,stderr=f)
 print(e.stem,r.returncode,flush=True)
