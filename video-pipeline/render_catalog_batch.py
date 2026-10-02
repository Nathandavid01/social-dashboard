from pathlib import Path
import json,subprocess,concurrent.futures
R=Path(__file__).resolve().parent
items=json.load(open(R/'runs/catalog-reedit-items.json'))
def render(x):
 s,v,_=x;out=R/f'runs/nanas-{s}-v{v}.mp4'
 if out.exists():return
 subprocess.run(['python3',str(R/'pipeline.py'),'render',str(R/f'edits/{s}-v{v}.json'),str(out)],check=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(render,items))
