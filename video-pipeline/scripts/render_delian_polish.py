import concurrent.futures,json,subprocess,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
plan=json.loads((R/'runs/delian-sept-polish/render-plan.json').read_text())
def render(x):
    output=Path(x['video']); log=R/'runs/delian-sept-polish'/(output.stem+'.log')
    if output.exists(): return {'video':output.name,'status':'existing_preserved'}
    with log.open('w') as f:
        p=subprocess.run([sys.executable,str(R/'pipeline.py'),'render',x['edit'],x['video']],cwd=R,stdout=f,stderr=subprocess.STDOUT)
    result={'video':output.name,'status':'rendered' if p.returncode==0 else 'failed','log':str(log)}
    print(json.dumps(result),flush=True)
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(render,plan))
(R/'runs/delian-sept-polish/render-results.json').write_text(json.dumps(results,indent=2))
