from pathlib import Path
import json,subprocess,urllib.request,urllib.parse,hashlib,concurrent.futures
from pipeline import synth_sounds,probe,FFMPEG
from review_loop import build
R=Path(__file__).resolve().parent;M=R/'media/music';O=R/'runs'
tracks={'padres':'Upbeat/Happy Whistling Ukulele.mp3','cumpleanos':'Upbeat/Funshine.mp3','practico':'Miscellaneous/Compy Jazz.mp3','fin-de-semana':'Electronic/Backbeat.mp3','snacks':'Miscellaneous/Downtown Boogie.mp3','seguridad':'Upbeat/Be Chillin.mp3','indoor':'Upbeat/Inspiration.mp3','parque':'Comedy/Busybody.mp3'}
clicks={'practico':[3.98,4.7,6.58],'indoor':[3.94,7.14,8.4],'seguridad':[4.07,6.23,9.87,12.23,16.81]}
audio_profile=json.loads((R/'styles/nanas-audio.json').read_text())
noise=audio_profile['voice_filter']
items=[]
def task(m):
 old=m['video'];s=old.removeprefix('nanas-').rsplit('-v',1)[0];v=m['version']+1;name=f'nanas-{s}-v{v}';out=O/(name+'.mp4');report=json.load(open(O/Path(old).with_suffix('.json')));e=report['edit'];T=sum(c['out']-c['in'] for c in e['clips']);track=tracks[s];song=M/Path(track).name
 url='https://raw.githubusercontent.com/0lhi/FreePD/stream/'+urllib.parse.quote(track)
 if not song.exists():urllib.request.urlretrieve(url,song)
 prov={'title':song.stem,'source':url,'license':'CC0 1.0','license_evidence':'https://github.com/0lhi/FreePD/blob/stream/LICENSE','sha256':hashlib.sha256(song.read_bytes()).hexdigest()};song.with_suffix('.provenance.json').write_text(json.dumps(prov,indent=2))
 work=O/(name+'-audio');work.mkdir(exist_ok=True);bed=M/(name+'-bed.wav')
 subprocess.run([FFMPEG,'-v','error','-y','-stream_loop','-1','-i',str(song),'-t',str(T),'-ac','2','-ar','48000','-af',f'loudnorm=I=-27:TP=-9:LRA=7,afade=t=in:d=0.15,afade=t=out:st={T-.5}:d=0.5',str(bed)],check=True)
 for t in clicks.get(s,[]):
  e['sounds']=[a for a in e['sounds'] if not (a['kind']=='whoosh' and abs(a['time']-t)<.16)]
  e['sounds'].append({**audio_profile['list_click'],'time':t,'reason':'Inicio de punto enumerado'})
 synth_sounds(work/'sounds.wav',T,e['sounds'])
 filters=[]
 for i,c in enumerate(e['clips']):filters.append(f'[1:a]atrim=start={c["in"]}:end={c["out"]},asetpts=PTS-STARTPTS[a{i}]')
 filters.append(''.join(f'[a{i}]' for i in range(len(e['clips'])))+f'concat=n={len(e["clips"])}:v=0:a=1, {noise}[voice]')
 filters.append('[voice][2:a][3:a]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89:level=false[mix]')
 tail=e['outro'];filters.append(f'[4:a]atrim=start={tail["in"]}:end={tail["out"]},asetpts=PTS-STARTPTS,aresample=48000,volume={tail.get("gain",.5)}[tail]');filters.append('[mix][tail]concat=n=2:v=0:a=1[a]')
 args=[FFMPEG,'-v','error','-y','-i',str(O/old),'-i',str((R/'edits'/e['source']).resolve()),'-i',str(work/'sounds.wav'),'-i',str(bed),'-i',str((R/'edits'/tail['source']).resolve()),'-filter_complex',';'.join(filters),'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(report['verification']['duration']),'-movflags','+faststart',str(out)]
 subprocess.run(args,check=True)
 subprocess.run([FFMPEG,'-v','error','-i',str(out),'-f','null','-'],check=True)
 e['music']={**prov,'source_url':url,'source':'../media/music/'+bed.name,'target_lufs':-27};e['voice_filter']=noise;e['previous_version']='../runs/'+old;e['review_notes'].append('Audio: música diferente por reel a -27 LUFS; reducción moderada de ambiente; clicks por punto de lista. Escucha final pendiente.')
 (R/f'edits/{s}-v{v}.json').write_text(json.dumps(e,ensure_ascii=False,indent=2));report.update(edit=e,output=probe(out));report['verification']['video_stream_copied_from']=old;report['audio_revision']={'noise_filter':noise,'music_lufs':-27,'list_clicks':clicks.get(s,[])};(O/(name+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));build(out);print(name,flush=True);return [s,v,m['title']]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:items=list(pool.map(task,json.load(open(O/'nanas-batch-manifest.json'))))
(O/'catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False))
