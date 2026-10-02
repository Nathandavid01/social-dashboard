from pathlib import Path
import json,re,subprocess
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;out=R/'runs'
items=[(s,v) for s,v,_ in json.load(open(R/'runs/catalog-reedit-items.json'))]
board=Image.new('RGB',(900,len(items)*344),'#221626');evidence=[]
for row,(slug,v) in enumerate(items):
 name=f'nanas-{slug}-v{v}';j=json.load(open(out/(name+'.json')));e=j['edit'];T=sum(x['out']-x['in'] for x in e['clips']);D=j['verification']['duration']
 assert j['verification']['full_decode']
 ass=(out/(name+'-render')/'captions.ass').read_text();sizes=set(re.findall(r'\\fs(\d+)',ass));assert sizes=={'85'},(name,sizes)
 support=[b['source'] for b in e['broll'] if b['source']!=e['source']];assert len(support)==len(set(support))
 times=[.7,T*.55,max(0,T-.08),T+.15,D-.15]
 if slug=='indoor':times[1]=13.3
 for col,t in enumerate(times):
  p=out/f'final-{slug}-{col}.jpg';subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(out/(name+'.mp4')),'-frames:v','1','-vf','scale=180:320','-y',str(p)],check=True)
  board.paste(Image.open(p),(col*180,row*344));ImageDraw.Draw(board).text((col*180,row*344+322),f'{slug} {t:.2f}',fill='white')
 evidence.append({'video':name+'.mp4','full_decode':True,'caption_sizes':list(sizes),'unique_support_sources':len(support),'sampled_times':times,'audio_listening':'pending_user'})
board.save(out/'nanas-batch-final-check.jpg')
(out/'nanas-batch-checks.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
print('8 videos: decode, fixed size, unique support and ending samples checked')
