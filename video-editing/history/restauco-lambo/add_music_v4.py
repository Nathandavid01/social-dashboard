from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parent
source=p/'Restauco-Lambo-VW-v3.mp4'
music=Path('$HOME/Downloads/WhatsApp Video 2026-08-04 at 21.13.24.mp4')
out=p/'Restauco-Lambo-VW-v4.mp4'
duration=36.066667
filters=";".join([
'[0:a]atrim=end=32.84,asetpts=PTS-STARTPTS,apad,atrim=duration=36.066667,asplit=2[voice][control]',
'[1:a]aresample=48000,asplit=2[m1][m2]',
'[m1]atrim=duration=30.8,asetpts=PTS-STARTPTS[mainmusic]',
'[m2]atrim=duration=6.1,asetpts=PTS-STARTPTS[repeatmusic]',
'[mainmusic][repeatmusic]acrossfade=d=0.8:c1=tri:c2=tri,atrim=duration=36.066667,volume=0.185,afade=t=in:st=0:d=0.45,afade=t=out:st=34.3:d=1.766667[music]',
'[music][control]sidechaincompress=threshold=0.035:ratio=3:attack=20:release=350:makeup=1[ducked]',
"[ducked]volume='if(lt(t,32.84),1,1+0.778*min((t-32.84)/0.7,1))':eval=frame[bed]",
'[voice][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=false:latency=true[a]'])
(p/'music-v4-filter.txt').write_text(filters)
cmd=['/opt/homebrew/bin/ffmpeg','-hide_banner','-n','-i',str(source),'-i',str(music),'-filter_complex',filters,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',str(duration),'-movflags','+faststart',str(out)]
with (p/'render-v4.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=log)
subprocess.run(['ffmpeg','-v','error','-i',str(out),'-f','null','-'],check=True)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
report={'output':out.name,'output_sha256':sha(out),'source_video':str(source),'music_source':str(music),'music_source_sha256':sha(music),'duration':duration,'voice_ends':32.84,'video_stream_copied':True,'full_decode':True,'music_notes':['User-supplied audio replaces the previous outro soundtrack and runs under the dialogue.','0.8-second crossfade loop extends the supplied 30.8-second track.','Music gain -14.66 dB, sidechain ducking under speech, gentle rise into outro, final fade to silence.'],'caption_note':'Caption content and approved visual style inherited from v3.'}
(p/'Restauco-Lambo-VW-v4.review.json').write_text(json.dumps(report,indent=2))
print(out)
