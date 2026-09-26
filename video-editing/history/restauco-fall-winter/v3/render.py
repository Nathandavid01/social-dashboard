from pathlib import Path
from PIL import Image
import subprocess,json,hashlib,shutil
from caption_style import make_caption
p=Path(__file__).resolve().parent;w=Path('$TMPDIR/restauco-sync-v3');w.mkdir(exist_ok=True)
source=Path('$HOME/Downloads/dji_mimo_20260922_153444_20260922153430_1790124988957_video.MP4')
outro=Path('$HOME/Downloads/RESTAUCOOUTROINGLES.mp4')
music=Path('$HOME/Downloads/WhatsApp Video 2026-08-04 at 21.13.24.mp4')
start=2.30;end=14.30;main=12;tail=166/30;total=main+tail;total_frames=526
phrases=[(2.40,3.18,'So, fall and winter'),(3.18,3.94,'are coming up.'),(4.04,4.64,"And if you're looking"),(4.64,5.67,'for something specifically'),(5.67,6.72,'like a battery,'),(6.92,7.90,'a heater core,'),(7.90,9.12,'or alternator,'),(9.40,10.24,'just give us a call'),(10.24,11.80,'or check Restauco.com'),(11.80,13.03,'and we can help you out'),(13.03,14.26,'with those items.')]
caps=[{'start':round(a-start,3),'end':round(b-start,3),'text':s,'source_start':a,'source_end':b} for a,b,s in phrases]
assert all(0<=c['start']<c['end']<=main for c in caps)
assert all(a['end']<=b['start'] for a,b in zip(caps,caps[1:]))
(p/'captions.json').write_text(json.dumps(caps,indent=2))
Image.new('RGBA',(1080,280)).save(w/'blank.png');parts=[];prev=0
for i,c in enumerate(caps):
 a,b=round(c['start']*30),round(c['end']*30)
 if a>prev:parts.append(('blank.png',(a-prev)/30))
 name=f'caption-{i:02d}.png';make_caption(c['text'],w/name);parts.append((name,(b-a)/30));prev=b
parts.append(('blank.png',(total_frames-prev)/30))
manifest='ffconcat version 1.0\n'+''.join(f"file '{name}'\nduration {duration:.9f}\n" for name,duration in parts)+"file 'blank.png'\n";(w/'captions.ffconcat').write_text(manifest)
ff='/opt/homebrew/bin/ffmpeg'
subprocess.run([ff,'-v','error','-y','-f','concat','-safe','0','-i',str(w/'captions.ffconcat'),'-vf','fps=30','-c:v','qtrle','-pix_fmt','argb',str(w/'captions.mov')],check=True)
filters=';'.join([
f'[0:v:0]trim=start={start}:end={end},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:flags=lanczos,setsar=1[main]',
f'[1:v:0]setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=166[tail]',
'[main][tail]concat=n=2:v=1:a=0[clean]',
'[clean][2:v]overlay=0:1255:eof_action=pass,format=yuv420p[v]',
f'[0:a:0]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,highpass=f=75,afftdn=nr=6:nf=-35:tn=1,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,afade=t=in:st=0:d=0.015,afade=t=out:st=11.94:d=0.06,apad,atrim=duration={total},asplit=2[voice][control]',
f'[3:a:0]atrim=duration={total},asetpts=PTS-STARTPTS,aresample=48000,volume=0.185,afade=t=in:st=0:d=0.35,afade=t=out:st={total-1.766667}:d=1.766667[music]',
'[music][control]sidechaincompress=threshold=0.035:ratio=3:attack=20:release=350:makeup=1[ducked]',
f"[ducked]volume='if(lt(t,{main}),1,1+0.778*min((t-{main})/0.7,1))':eval=frame[bed]",
'[voice][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=false:latency=true[a]'])
(p/'filter.txt').write_text(filters)
out=p.parent/'Restauco-Fall-Winter-v3.mp4'
cmd=[ff,'-hide_banner','-n','-threads','2','-filter_complex_threads','2','-i',str(source),'-i',str(outro),'-i',str(w/'captions.mov'),'-i',str(music),'-filter_complex',filters,'-map','[v]','-map','[a]','-c:v','libx264','-preset','slow','-crf','18','-threads','4','-c:a','aac','-b:a','256k','-ar','48000','-t',str(total),'-movflags','+faststart',str(out)]
with (p/'render.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=log)
subprocess.run([ff,'-v','error','-i',str(out),'-f','null','-'],check=True)
meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',str(out)]))
assert abs(float(meta['format']['duration'])-total)<.1
report={'output':out.name,'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source':str(source),'verification':{'full_decode':True,'duration':meta['format']['duration'],'expected_duration':total},'source_range':[start,end],'captions':caps,'caption_timing_basis':'Whisper small cross-attention DTW with flash attention disabled, verified by independent cropped runs; ASR offset fields were not used.','caption_style':'Same gradient Tahoma raster treatment, 3x supersampling.','music_source':str(music),'outro_source':str(outro),'outro_start':main,'editorial_notes':['Removed all pre-roll before source2.30; first actual word begins around2.40.','Retained last word and reaction through source14.30.','Gentle broadband noise reduction, normalized dialogue, music ducking, full English outro.'],'visual_review':'pending','opening_check':'pending'}
(p.parent/'Restauco-Fall-Winter-v3.review.json').write_text(json.dumps(report,indent=2));print(out)
