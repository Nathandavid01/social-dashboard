"""Helpers for the Nana's pending-ideas batch; reviewed ranges are supplied explicitly."""
import json,subprocess,copy
from pathlib import Path
from PIL import ImageFont
from pipeline import cut_words,group_captions
R=Path(__file__).resolve().parent
inventory=json.load(open(R/'runs/pending-inventory.json'))
font=ImageFont.truetype(str(R/'media/brand/QUARTZO.ttf'),85)
def find(prefix):return next(r for r in inventory if r['id'].startswith(prefix))
def load(prefix):
 row=find(prefix);j=json.load(open(R/'runs'/f"{row['id']}-transcript.json"))
 return row,j

def make(slug,prefix,clips,broll=(),title=None):
 row,j=load(prefix)
 # Brand/location spellings are client-confirmed; no invented dialogue.
 for s in j['segments']:
  for w in s['words']:
   w['word']=w['word'].replace('Montserrat','Monserrate')
 fixes={
  '81d4110f':{'hacer':'haces','que':'en','nada.':'Nana’s.','tocas.':'tu casa.'},
  'b4096a9e':{'se':'sé','acasen':'qué hacer','Trae':'Tráelos','los':'a','bananas':'Nana’s'},
  'ef353aeb':{'Mediante':'Medias','de':'','elezante':'antideslizantes'},
  '2e51d9d4':{'Ahí':'Ay,','te':'es','atiendas':'que','Veintenceño.':'Ven, te enseño.'}}
 for segment in j['segments']:
  for w in segment['words']:
   for pref,changes in fixes.items():
    if row['id'].startswith(pref):
     old=w['word'].strip()
     # Specific corrections only in the affected phrase, not global articles.
     if pref=='81d4110f' and old=='que' and w['start']<4.4:continue
     if pref=='b4096a9e' and old=='los' and w['start']<6.2:continue
     if pref=='ef353aeb' and old=='de' and w['start']<7.5:continue
     if old in changes:w['word']=' '+changes[old]
 reviewed=R/'runs'/f'{slug}-reviewed.json';reviewed.write_text(json.dumps(j,ensure_ascii=False,indent=2))
 e=json.load(open(R/'edits/tour-v2.json'))
 for k in ['previous_version','captions']:e.pop(k,None)
 e.update(title=title or row['title'],idea_id=row['idea_id'],source='../media/'+row['id']+'.mp4',transcript='../runs/'+reviewed.name,clips=[{'in':a,'out':b,'zoom':1.02} for a,b in clips])
 T=round(sum(b-a for a,b in clips),3)
 words=cut_words([w for s in j['segments'] for w in s['words']],e['clips'])
 caps=[];block=[]
 for w in words:
  if not w['word'].strip():continue
  candidate=' '.join(x['word'].strip() for x in block+[w]).upper().replace("NANA'S",'NANA’S')
  if block and (len(block)>=3 or font.getlength(candidate)>810 or w['start']-block[-1]['end']>.35 or block[-1]['word'].strip().endswith(('.', '?', ','))):
   caps.append({'start':block[0]['start'],'end':block[-1]['end'],'text':' '.join(x['word'].strip() for x in block).upper()});block=[]
  block.append(w)
 if block:caps.append({'start':block[0]['start'],'end':block[-1]['end'],'text':' '.join(x['word'].strip() for x in block).upper()})
 for i,c in enumerate(caps):c['end']=min(caps[i+1]['start'] if i+1<len(caps) else T,c['end']+.12)
 for c in caps:
  c['text']=c['text'].replace('NANAS','NANA’S').replace("NANA'S",'NANA’S')
  if c['text']=='9392992969':c['text']='939\n299-2969'
  if max(font.getlength(line) for line in c['text'].split('\n'))>820:raise ValueError('Caption too wide: '+c['text'])
 e['captions']=caps
 e['broll']=[]
 # A-roll motion carries original speech, and is identified separately from support footage.
 offset=0
 for a,b in clips:
  e['broll'].append({'source':e['source'],'in':a,'out':b,'at':round(offset,3),'reason':'A-roll original con zoom suave','eof_action':'repeat','zoom_keyframes':[{'time':0,'zoom':1},{'time':round(b-a,3),'zoom':1.065}]});offset+=b-a
 for prefix,a,b,at,why in broll:
  if '/' in prefix:src=prefix
  else:
   files=list((R/'media').glob(prefix+'*.mp4'));assert len(files)==1
   src='../media/'+files[0].name
  e['broll'].append({'source':src,'in':a,'out':b,'at':at,'reason':why,'eof_action':'repeat','zoom_keyframes':[{'time':0,'zoom':1},{'time':round(b-a,3),'zoom':1.06}]})
 support=[x['source'] for x in e['broll'] if x['source']!=e['source']]
 assert len(set(support))==len(support)
 changes=sorted(set([round(x['at'],3) for x in e['broll'][1:] if x['at']>.1]+[round(x['at']+x['out']-x['in'],3) for x in e['broll'][len(clips):] if x['at']+x['out']-x['in']<T-.25]))
 e['sounds']=[{'time':0,'kind':'click','gain_db':-20,'duration':.045}]+[{'time':t,'kind':'whoosh','gain_db':-23,'duration':.15} for t in changes if t<T-.15]
 e['transitions']=[{'time':t,'duration':.10} for t in changes if t<T-.15]
 e['review_notes']=['Idea y grabaciones del dashboard; selección de rangos revisada.','B-roll vinculado al diálogo; tomas de apoyo sin repetir dentro del reel.','QUARTZO 85px: frases breves para conservar tamaño. Zooms suaves y música CC0.','Escucha crítica y aprobación del usuario pendientes.']
 music=R/'media/music'/f'{slug}-bed.wav'
 subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg','-v','error','-y','-i',str(R/'media/music/Happy-Whistling-Ukulele.mp3'),'-t',str(T),'-ac','2','-ar','48000','-af',f'loudnorm=I=-29:TP=-9:LRA=7,afade=t=in:d=0.15,afade=t=out:st={max(0,T-.6)}:d=0.6',str(music)],check=True)
 e['music']['source']='../media/music/'+music.name
 dest=R/'edits'/f'{slug}-v1.json';dest.write_text(json.dumps(e,ensure_ascii=False,indent=2));print(slug,T)
 return e
