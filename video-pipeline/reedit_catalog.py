from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;rows={x['number']:x for x in json.load(open(R/'media/broll-index.json'))};cat=json.load(open(R/'runs/catalog.json'))
plans={'padres':[(22,.5,3.26,1.32)],'cumpleanos':[(3,.5,1.24,1.55)],'practico':[(33,.2,4.93,1.5)],'fin-de-semana':[(7,10,2.96,1),(20,5,6.18,2.1)],'snacks':[(28,4,5.05,1.77),(15,6,6.82,1.14),(17,2,7.96,1.5)],'seguridad':[(23,.5,6.2,3.6)],'indoor':[(6,1,0,3.9),(27,1,3.9,3.12),(26,.5,7.02,1.48),(3,5,8.5,2.76)],'parque':[(13,1,8.13,3),(18,10.4,11.13,2.2)]}
items=[];samples=[]
for m in json.load(open(R/'runs/nanas-batch-manifest.json')):
 old=m['video'];slug=old.removeprefix('nanas-').rsplit('-v',1)[0];v=m['version']+1;d=json.load(open(R/'runs'/Path(old).with_suffix('.json')))['edit']
 idea=next(i for i in cat['ideas'] if i['id']==d['idea_id'])
 b=[x for x in d['broll'] if x['source']==d['source'] or (slug=='practico' and 'cleaning-detail' in x['source']) or (slug=='parque' and 'venue-wide' in x['source'])]
 for num,start,at,dur in plans[slug]:
  x=rows[num];b.append({'source':'../'+x['source'],'in':start,'out':round(start+dur,3),'at':at,'reason':x['description'],'eof_action':'repeat','zoom_keyframes':[{'time':0,'zoom':1},{'time':dur,'zoom':1.045}]});samples.append((slug,num,start,dur))
 d['broll']=b;T=sum(c['out']-c['in'] for c in d['clips']);times=sorted(set(round(t,3) for x in b if x['source']!=d['source'] for t in [x['at'],x['at']+x['out']-x['in']] if .01<t<T-.08))
 d['transitions']=[{'time':t,'duration':.08} for t in times];d['sounds']=[{'time':0,'kind':'click','gain_db':-20,'duration':.045}]+[{'time':t,'kind':'whoosh','gain_db':-25,'duration':.12} for t in times];d['previous_version']='../runs/'+old;d['review_notes'].append('Reedición con catálogo completo: asignación por frase y variedad entre los ocho reels; B-roll sin audio original.');p=R/f'edits/{slug}-v{v}.json';p.write_text(json.dumps(d,ensure_ascii=False,indent=2));items.append((slug,v,m['title']))
(R/'runs/catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False))
board=Image.new('RGB',(720,len(samples)*196),'#231e27')
for i,(slug,num,start,dur) in enumerate(samples):
 for j in range(4):
  t=start+.06+(dur-.12)*j/3;p=R/'runs/catalog-sample.jpg';subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(R/rows[num]['source']),'-frames:v','1','-vf','scale=101:180','-y',str(p)],check=True);board.paste(Image.open(p),(j*180,i*196));ImageDraw.Draw(board).text((j*180+103,i*196+15),f'{slug[:7]}\n#{num}\n{t:.2f}s',fill='white')
board.save(R/'runs/catalog-reedit-selections.jpg');print(items)
