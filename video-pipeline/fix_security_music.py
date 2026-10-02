from pathlib import Path
import json,subprocess
from pipeline import FFMPEG,synth_sounds,probe
from review_loop import build
R=Path(__file__).resolve().parent;O=R/'runs';old='nanas-seguridad-v4';name='nanas-seguridad-v5';d=json.load(open(O/(old+'.json')));e=d['edit'];T=sum(c['out']-c['in'] for c in e['clips']);work=O/(name+'-audio');work.mkdir(exist_ok=True);bed=R/'media/music'/f'{name}-bed.wav'
subprocess.run([FFMPEG,'-v','error','-y','-ss','8','-i',str(R/'media/music/Be Chillin.mp3'),'-t',str(T),'-ac','2','-ar','48000','-af',f'loudnorm=I=-27:TP=-9:LRA=7,afade=t=in:d=0.06,afade=t=out:st={T-.45}:d=0.45',str(bed)],check=True)
synth_sounds(work/'sounds.wav',T,e['sounds']);filters=[]
for i,c in enumerate(e['clips']):filters.append(f'[1:a]atrim=start={c["in"]}:end={c["out"]},asetpts=PTS-STARTPTS[a{i}]')
filters.append(''.join(f'[a{i}]' for i in range(len(e['clips'])))+f'concat=n={len(e["clips"])}:v=0:a=1,{e["voice_filter"]}[voice]')
filters+=['[voice][2:a][3:a]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89:level=false[mix]','[4:a]atrim=duration=3.3,asetpts=PTS-STARTPTS,aresample=48000[tail]','[mix][tail]concat=n=2:v=0:a=1[a]']
subprocess.run([FFMPEG,'-v','error','-y','-i',str(O/(old+'.mp4')),'-i',str((R/'edits'/e['source']).resolve()),'-i',str(work/'sounds.wav'),'-i',str(bed),'-i',str((R/'edits'/e['outro']['source']).resolve()),'-filter_complex',';'.join(filters),'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(d['verification']['duration']),'-movflags','+faststart',str(O/(name+'.mp4'))],check=True)
subprocess.run([FFMPEG,'-v','error','-i',str(O/(name+'.mp4')),'-f','null','-'],check=True)
e['music'].update(source_url=e['music']['source'],source='../media/music/'+bed.name,target_lufs=-27,source_in=8);e['previous_version']='../runs/'+old+'.mp4';e['review_notes'].append('Música: eliminar inicio silencioso y subir objetivo de -34 a -27 LUFS.');d['verification']['video_stream_copied_from']=old+'.mp4';d['output']=probe(O/(name+'.mp4'));d['audio_revision']['music_lufs']=-27;(O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2));(R/'edits/seguridad-v5.json').write_text(json.dumps(e,ensure_ascii=False,indent=2));build(O/(name+'.mp4'))
items=json.load(open(O/'catalog-reedit-items.json'))
for x in items:
 if x[0]=='seguridad':x[1]=5
(O/'catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False))
