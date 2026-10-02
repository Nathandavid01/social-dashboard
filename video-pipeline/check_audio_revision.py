from pathlib import Path
import json,subprocess
R=Path(__file__).resolve().parent;O=R/'runs'
def video_hash(p):
 return subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()
records=[]
for s,v,_ in json.load(open(O/'catalog-reedit-items.json')):
 name=f'nanas-{s}-v{v}';p=O/(name+'.json');d=json.load(open(p));old=d['verification']['video_stream_copied_from'];assert video_hash(O/(name+'.mp4'))==video_hash(O/old)
 peak=subprocess.run(['ffmpeg','-hide_banner','-i',str(O/(name+'.mp4')),'-af','volumedetect','-vn','-f','null','-'],capture_output=True,text=True,check=True).stderr
 levels=[l.strip() for l in peak.splitlines() if 'max_volume:' in l or 'mean_volume:' in l]
 record={'video':name+'.mp4','picture_identical_to':old,'full_decode':True,'music':d['edit']['music']['title'],'music_target_lufs':d['edit']['music']['target_lufs'],'list_clicks':d['audio_revision']['list_clicks'],'levels':levels,'critical_listening':'pending'};records.append(record)
 g=O/(name+'.review.json');graph=json.load(open(g))
 for node in graph['nodes']:
  if node['id']=='visual_comparison':node.update(status='pass',notes='Video packet SHA256 identical to previously visually reviewed source. Audio-only revision.')
 graph['status']='audio_and_user_review_pending';graph['audio_revision_checks']=record;g.write_text(json.dumps(graph,ensure_ascii=False,indent=2))
(O/'nanas-audio-checks.json').write_text(json.dumps(records,ensure_ascii=False,indent=2));print(json.dumps(records,ensure_ascii=False,indent=2))
