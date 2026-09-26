from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parent
P=ROOT/'pipeline'
p=P/'pipeline.py'
s=p.read_text()
old='drawbox=x=458:y={style.get("accent_y", 1570)}:w=164:h=5:color=0x237f86:t=fill,drawbox=x=622:y={style.get("accent_y", 1570)}:w=36:h=5:color=0xd6a249:t=fill,'
assert old in s
p.write_text(s.replace(old,''))
source='$HOME/Downloads/dji_mimo_20260922_175002_20260922174922_1790124960225_video.MP4'
reference='$HOME/Downloads/dummy - 2026-09-26T013320.088.mp4'
style={'font_family':'Arial','font_file':'Arial.ttf','font_size':72,'primary_colour':'&H00FFFFFF','outline_colour':'&H80303030','back_colour':'&H80000000','bold':0,'outline':3,'shadow':3,'bottom_margin':415,'margin_x':100,'max_words':9,'max_chars':50,'caption_animation':'none','fixed_size':True,'wrap_width':890}
(P/'styles/reference.json').write_text(json.dumps(style,indent=2))
raw=json.loads((ROOT/'transcript.json').read_text())
words=[]
for segment in raw['transcription']:
 for t in segment['tokens']:
  if not t['text'].startswith('[_') and t['offsets']['to']>t['offsets']['from']:
   words.append({'word':t['text'],'start':t['offsets']['from']/1000,'end':t['offsets']['to']/1000})
(P/'transcript.json').write_text(json.dumps({'segments':[{'words':words}],'provenance':'whisper.cpp small, raw JSON retained in parent directory'},ensure_ascii=False,indent=2))
clips=[{'in':2.08,'out':13.1,'zoom':1},{'in':16.5,'out':38.32,'zoom':1}]
# Source-time captions: sentence case, one or two lines, no animated emphasis.
phrases=[
(2.16,4.12,'Gente, yo quiero\nque ustedes vean esto,'),
(4.63,6.15,'porque mucha gente ha dicho'),
(6.15,8.98,'que yo me mofo de los\ndueños de estos carros.'),
(9.12,10.05,'Yo no me mofo,'),
(10.08,11.55,'yo digo la realidad.'),
(11.68,12.9,'Ven para que veas esto.'),
(17.16,17.8,'Ven acá.'),
(19.35,20.85,'Eso es el turbo, ¿verdad?'),
(21.28,22.55,'¿Y qué dice ahí?'),
(23.42,24.95,'¡Adiós! Ahí dice VW.'),
(27.2,27.9,'Ven acá.'),
(28.12,29.82,'Y si buscamos esa pieza,'),
(32.05,33.25,'¿dirá Lambo'),
(33.78,34.86,'o dirá VW?'),
(35.02,35.62,'Pero…'),
]
captions=[]
for a,b,text in phrases:
 offset=0
 for clip in clips:
  if clip['in']<=a<b<=clip['out']:
   captions.append({'start':round(a-clip['in']+offset,3),'end':round(b-clip['in']+offset,3),'text':text})
  offset+=clip['out']-clip['in']
edit={'source':source,'transcript':'../transcript.json','style':'../styles/reference.json','clips':clips,'captions':captions,'sounds':[],'effects':[],'catalog':'catalog.json','idea_id':'reference-edit','references':{'edited_example':reference},'voice_filter':'highpass=f=65,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000','editorial_notes':['Reference-style sentence-case white Arial captions with dark shadow; no inherited brand accent.','Countdown and camera-walk pause removed. Engine demonstration kept in original order.','Final sentence after pero remains audible but uncaptioned pending user wording confirmation.']}
(P/'edits/v1.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2))
(P/'catalog.json').write_text(json.dumps({'fetched_at':'2026-09-26','ideas':[{'id':'reference-edit','title':'Restauco — Lambo / VW','hook':'Gente, yo quiero que ustedes vean esto.'}]}))
print('Prepared',round(sum(c['out']-c['in'] for c in clips),3),'seconds')
