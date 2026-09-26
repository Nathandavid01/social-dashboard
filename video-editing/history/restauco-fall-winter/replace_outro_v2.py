from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parent
video=p/'Restauco-Fall-Winter-v1.mp4'
outro=Path('$HOME/Downloads/RESTAUCOOUTROINGLES.mp4')
source=Path('$HOME/Downloads/dji_mimo_20260922_153444_20260922153430_1790124988957_video.MP4')
music=Path('$HOME/Downloads/WhatsApp Video 2026-08-04 at 21.13.24.mp4')
main=422/30;tail=166/30;total=main+tail
filters=';'.join([
f'[0:v]trim=end_frame=422,setpts=PTS-STARTPTS,setsar=1[main]',
f'[1:v:0]setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=166[tail]',
'[main][tail]concat=n=2:v=1:a=0,format=yuv420p[v]',
f'[2:a:0]atrim=end={main},asetpts=PTS-STARTPTS,highpass=f=65,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,apad,atrim=duration={total},asplit=2[voice][control]',
f'[3:a:0]atrim=duration={total},asetpts=PTS-STARTPTS,aresample=48000,volume=0.185,afade=t=in:st=0:d=0.45,afade=t=out:st={total-1.766667}:d=1.766667[music]',
'[music][control]sidechaincompress=threshold=0.035:ratio=3:attack=20:release=350:makeup=1[ducked]',
f"[ducked]volume='if(lt(t,{main}),1,1+0.778*min((t-{main})/0.7,1))':eval=frame[bed]",
'[voice][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=false:latency=true[a]'])
(p/'v2-filter.txt').write_text(filters)
out=p/'Restauco-Fall-Winter-v2.mp4';ff='/opt/homebrew/bin/ffmpeg'
cmd=[ff,'-hide_banner','-n','-threads','2','-filter_complex_threads','2','-i',str(video),'-i',str(outro),'-i',str(source),'-i',str(music),'-filter_complex',filters,'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-threads','4','-c:a','aac','-b:a','256k','-ar','48000','-t',str(total),'-movflags','+faststart',str(out)]
with (p/'render-v2.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=log)
subprocess.run([ff,'-v','error','-i',str(out),'-f','null','-'],check=True)
meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',str(out)]))
assert abs(float(meta['format']['duration'])-total)<.1
report={'output':out.name,'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'verification':{'full_decode':True,'duration':meta['format']['duration'],'expected_duration':total},'outro_source':str(outro),'outro_sha256':hashlib.sha256(outro.read_bytes()).hexdigest(),'outro_start':main,'outro_duration':tail,'captions':'Preserved from v1','music_source':str(music),'music':'Same bed, extended through new outro, final fade retained','visual_review':'pending'}
(p/'Restauco-Fall-Winter-v2.review.json').write_text(json.dumps(report,indent=2));print(out)
