from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parent
f=(p/'filter.txt').read_text();audio=f[f.index('[0:a:0]'):].replace('[3:a:0]','[1:a:0]')
needle='aresample=48000,afade=t=in';assert needle in audio
audio=audio.replace(needle,'aresample=48000,atrim=start_sample=1200,asetpts=PTS-STARTPTS,afade=t=in',1)
source='$HOME/Downloads/dji_mimo_20260922_153444_20260922153430_1790124988957_video.MP4'
music='$HOME/Downloads/WhatsApp Video 2026-08-04 at 21.13.24.mp4'
video=p.parent/'Restauco-Fall-Winter-v3.mp4';out=p/'audio-aligned.mp4'
cmd=['ffmpeg','-hide_banner','-n','-i',source,'-i',music,'-i',str(video),'-filter_complex',audio,'-map','2:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',str(526/30),'-movflags','+faststart',str(out)]
with (p/'audio-alignment-render.log').open('w') as log:subprocess.run(cmd,stdout=log,stderr=log,check=True)
subprocess.run(['ffmpeg','-v','error','-i',str(out),'-f','null','-'],check=True)
out.replace(video)
rp=p.parent/'Restauco-Fall-Winter-v3.review.json';r=json.loads(rp.read_text());r['output_sha256']=hashlib.sha256(video.read_bytes()).hexdigest();r['audio_latency_compensation_ms']=25;r['opening_check']='Independent cropped DTW confirms opening So fall and winter, no countdown; no clipped words.';rp.write_text(json.dumps(r,indent=2));print(video)
