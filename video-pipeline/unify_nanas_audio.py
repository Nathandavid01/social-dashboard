from pathlib import Path
import json,subprocess
from pipeline import FFMPEG,synth_sounds,probe
from review_loop import build
R=Path(__file__).resolve().parent;O=R/'runs';M=R/'media/music'
noise='highpass=f=110,afftdn=nr=18:nf=-28:tn=1,agate=threshold=0.035:ratio=3:range=0.12:attack=10:release=150,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000'
items=json.load(open(O/'catalog-reedit-items.json'))
def run(args):return subprocess.run([FFMPEG,'-v','error']+args,check=True)
def vh(p):return subprocess.check_output([FFMPEG,'-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()
for item in items:
 s,v,_=item;old=f'nanas-{s}-v{v}';d=json.load(open(O/(old+'.json')));e=d['edit']
 if e.get('voice_filter')==noise and e['music'].get('target_lufs')==-27:continue
 name=f'nanas-{s}-v{v+1}';out=O/(name+'.mp4');assert not out.exists()
 T=sum(c['out']-c['in'] for c in e['clips']);work=O/(name+'-audio');work.mkdir(exist_ok=True);bed=M/(name+'-bed.wav');start=8 if s=='seguridad' else 3
 song=M/(e['music']['title']+'.mp3')
 if not song.exists():song=M/(e['music']['title'].replace(' ','-')+'.mp3')
 assert song.exists(),song
 run(['-y','-ss',str(start),'-stream_loop','-1','-i',str(song),'-t',str(T),'-ac','2','-ar','48000','-af',f'loudnorm=I=-27:TP=-9:LRA=7,afade=t=in:d=0.06,afade=t=out:st={T-.45}:d=0.45',str(bed)])
 synth_sounds(work/'sounds.wav',T,e['sounds']);f=[]
 for i,c in enumerate(e['clips']):f.append(f'[1:a]atrim=start={c["in"]}:end={c["out"]},asetpts=PTS-STARTPTS[a{i}]')
 f.append(''.join(f'[a{i}]' for i in range(len(e['clips'])))+f'concat=n={len(e["clips"])}:v=0:a=1,{noise}[voice]')
 tail=e['outro'];f+=['[voice][2:a][3:a]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89:level=false[mix]',f'[4:a]atrim=start={tail["in"]}:end={tail["out"]},asetpts=PTS-STARTPTS,aresample=48000,volume={tail.get("gain",1)}[tail]','[mix][tail]concat=n=2:v=0:a=1[a]']
 run(['-i',str(O/(old+'.mp4')),'-i',str((R/'edits'/e['source']).resolve()),'-i',str(work/'sounds.wav'),'-i',str(bed),'-i',str((R/'edits'/tail['source']).resolve()),'-filter_complex',';'.join(f),'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(d['verification']['duration']),'-movflags','+faststart',str(out)])
 run(['-i',str(out),'-f','null','-']);assert vh(out)==vh(O/(old+'.mp4'))
 if e['music']['source'].startswith('http'):e['music']['source_url']=e['music']['source']
 e['music'].update(source='../media/music/'+bed.name,target_lufs=-27,source_in=start);e['voice_filter']=noise;e['previous_version']='../runs/'+old+'.mp4';e['review_notes'].append('Regla común Nana’s: voz -16 LUFS, música -27 LUFS, ambiente reducido. Escucha crítica pendiente.')
 d.update(edit=e,output=probe(out));d['verification'].update(full_decode=True,video_stream_copied_from=old+'.mp4');d['audio_revision']={'noise_filter':noise,'music_lufs':-27,'list_clicks':[x['time'] for x in e['sounds'] if x.get('reason')=='Inicio de punto enumerado']}
 (O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2));(R/f'edits/{s}-v{v+1}.json').write_text(json.dumps(e,ensure_ascii=False,indent=2));build(out)
 p=O/(name+'.review.json');g=json.load(open(p))
 for n in g['nodes']:
  if n['id']=='visual_comparison':n.update(status='pass',notes='Video packet SHA256 matches previous reviewed version. Audio-only change; critical listening pending.')
 g['status']='audio_and_user_review_pending';p.write_text(json.dumps(g,ensure_ascii=False,indent=2));item[1]=v+1
 (O/'catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False));print(name,flush=True)
