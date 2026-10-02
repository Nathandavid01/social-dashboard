import copy,json,subprocess
from pathlib import Path
from pipeline import cut_words
R=Path(__file__).resolve().parent
rows=json.load(open(R/'runs/pending-inventory.json'))
def combine(slug,parts):
 args=['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg','-v','error'];fs=[];words=[];offset=0;provenance=[]
 for i,(pref,a,b) in enumerate(parts):
  row=next(r for r in rows if r['id'].startswith(pref));j=json.load(open(R/'runs'/f"{row['id']}-transcript.json"))
  ww=[w for seg in j['segments'] for w in seg['words']]
  for w in ww:
   if pref=='ef353aeb' and w['start']>=7.2:
    w['word']={'Mediante':' Medias','de':'','elezante':' antideslizantes'}.get(w['word'].strip(),w['word'])
   if pref=='a856d718':
    w['word']={'pelar':' pelear','te':' deben','van':'','a':'','y':''}.get(w['word'].strip(),w['word'])
    if w['word'].strip()=='incorrectamente.':w['end']=13.60
   if pref=='2e51d9d4':
    w['word']={'Ahí':' Ay,','te':' es','atiendas':' que','Veintenceño.':' Ven, te enseño.'}.get(w['word'].strip(),w['word'])
  mapped=cut_words(ww,[{'in':a,'out':b}]);words += [{**w,'start':round(w['start']+offset,3),'end':round(w['end']+offset,3)} for w in mapped]
  args += ['-i',row['source']]
  fs += [f'[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[v{i}]',f'[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000[a{i}]']
  offset+=b-a;provenance.append({'source':row['source'],'in':a,'out':b})
 first=next(r for r in rows if r['id'].startswith(parts[0][0]));ident='assembled-'+slug;out=R/'media'/f'{ident}.mp4'
 fs.append(''.join(f'[v{i}][a{i}]' for i in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=1[v][a]')
 if not out.exists():subprocess.run(args+['-filter_complex_threads','1','-filter_complex',';'.join(fs),'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-threads','4','-c:a','aac','-b:a','192k',str(out)],check=True)
 (R/'runs'/f'{ident}-transcript.json').write_text(json.dumps({'segments':[{'words':words}],'source_assembly':provenance},ensure_ascii=False,indent=2))
 rows.append({**first,'id':ident,'source':str(out),'duration':round(offset,3)})
 (R/'runs/pending-inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 print(ident,round(offset,3))
if __name__=='__main__':
 combine('seguridad',[('ef353aeb',1.60,5.55),('ef353aeb',7.12,9.28),('a856d718',3.22,13.80),('e9754e86',.70,4.06)])
 combine('indoor',[('098e35e2',1.66,12.92),('4a4ba726',5.64,13.1)])
 combine('parque',[('2e51d9d4',1.42,9.55),('650bab95',6.28,14.30)])
