from pathlib import Path
from PIL import Image
import subprocess,json,hashlib
from caption_style import make_caption
p=Path(__file__).resolve().parent;w=Path('$TMPDIR/restauco-153444-render');w.mkdir(exist_ok=True)
source=Path('$HOME/Downloads/dji_mimo_20260922_153444_20260922153430_1790124988957_video.MP4')
reference=Path('$HOME/Downloads/dummy - 2026-09-26T013320.088.mp4')
music=Path('$HOME/Downloads/WhatsApp Video 2026-08-04 at 21.13.24.mp4')
main_frames=422;total_frames=518;main=main_frames/30;total=total_frames/30
phrases=[(0,2.35,'So, fall and winter'),(2.4,3.8,'are coming up,'),(3.83,4.77,"and if you're looking for"),(4.79,5.56,'something specifically'),(5.56,6.58,'like a battery,'),(6.58,7.76,'a heater core,'),(7.76,8.78,'or alternator,'),(8.81,9.91,'just give us a call'),(9.91,11.35,'or check Restauco.com'),(11.37,12.56,'and we can help you out'),(12.58,13.95,'with those items.')]
caps=[{'start':a,'end':b,'text':s} for a,b,s in phrases];(p/'captions.json').write_text(json.dumps(caps,ensure_ascii=False,indent=2))
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
f'[0:v:0]trim=end={main},setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[main]',
'[1:v:0]trim=start=50.6:end=53.8,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1[tail]',
'[main][tail]concat=n=2:v=1:a=0[clean]',
'[clean][2:v]overlay=0:1255:eof_action=pass,format=yuv420p[v]',
f'[0:a:0]atrim=end={main},asetpts=PTS-STARTPTS,highpass=f=65,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,apad,atrim=duration={total},asplit=2[voice][control]',
f'[3:a:0]atrim=duration={total},asetpts=PTS-STARTPTS,aresample=48000,volume=0.185,afade=t=in:st=0:d=0.45,afade=t=out:st={total-1.766667}:d=1.766667[music]',
'[music][control]sidechaincompress=threshold=0.035:ratio=3:attack=20:release=350:makeup=1[ducked]',
f"[ducked]volume='if(lt(t,{main}),1,1+0.778*min((t-{main})/0.7,1))':eval=frame[bed]",
'[voice][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=false:latency=true[a]'])
(p/'filter.txt').write_text(filters)
out=p/'Restauco-Fall-Winter-v1.mp4'
cmd=[ff,'-hide_banner','-n','-threads','2','-filter_complex_threads','2','-i',str(source),'-i',str(reference),'-i',str(w/'captions.mov'),'-i',str(music),'-filter_complex',filters,'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','19','-threads','4','-c:a','aac','-b:a','256k','-ar','48000','-t',str(total),'-movflags','+faststart',str(out)]
with (p/'render.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=log)
subprocess.run([ff,'-v','error','-i',str(out),'-f','null','-'],check=True)
meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',str(out)]))
assert abs(float(meta['format']['duration'])-total)<.1
report={'output':out.name,'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'verification':{'full_decode':True,'duration':meta['format']['duration'],'expected_duration':total},'source_range':[0,main],'captions':caps,'caption_style':'Exact raster-caption implementation reused from Restauco Lambo VW v5: Tahoma Regular, gradient white/silver, gray outline, soft shadow.','music_source':str(music),'outro_source':str(reference),'outro_range':[50.6,53.8],'editorial_notes':['Preserved entire spoken English message; trimmed only trailing idle footage.','Website spelling corrected from ASR to Restauco.com using the supplied branded outro.','Same music, ducking, fade and original Restauco outro as the previous approved edit.'],'visual_review':'pending'}
(p/'Restauco-Fall-Winter-v1.review.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(out)
