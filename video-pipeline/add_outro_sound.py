from pathlib import Path
import json,subprocess,hashlib
import numpy as np
from scipy.io import wavfile
from pipeline import FFMPEG,probe
from review_loop import build
R=Path(__file__).resolve().parent;O=R/'runs';B=R/'media/brand';sr=48000;duration=3.3;t=np.arange(round(sr*duration))/sr;y=np.zeros(len(t));rng=np.random.default_rng(743)
def add(at,z,g):
 a=round(at*sr);n=min(len(z),len(y)-a);y[a:a+n]+=z[:n]*g
u=np.arange(int(.44*sr))/sr;noise=rng.normal(0,1,len(u));noise=np.convolve(noise,np.ones(15)/15,mode='same');add(0,noise*np.sin(np.pi*u/.44)**2,.19)
# Gentle downward spring for star landing; bright tones follow graphic assembly.
u=np.arange(int(.3*sr))/sr;phase=2*np.pi*(340*u-250*u*u);add(.35,np.sin(phase)*np.exp(-u*18)*(1-np.exp(-u*180)),.15)
for at,f,g in [(.62,784,.07),(1.04,988,.07),(1.48,1175,.065),(1.92,1568,.055)]:
 u=np.arange(int((duration-at)*sr))/sr;z=(np.sin(2*np.pi*f*u)+.25*np.sin(2*np.pi*2.01*f*u))*np.exp(-u*3.4)*(1-np.exp(-u*100));add(at,z,g)
# Quiet sustained sparkle, fading through the end of the logo hold.
u=np.arange(int(1.4*sr))/sr;add(1.9,(np.sin(2*np.pi*1568*u)+np.sin(2*np.pi*1976*u))*.5*np.exp(-u*2.4)*(1-np.exp(-u*40)),.025)
y[-int(.2*sr):]*=np.linspace(1,0,int(.2*sr));stereo=np.column_stack([y,y]);wav=B/'outro-star-sfx.wav';wavfile.write(wav,sr,(stereo*32767).astype(np.int16))
(B/'outro-star-sfx.json').write_text(json.dumps({'created':'Original procedural sound design','duration':duration,'events':[{'time':0,'effect':'soft whoosh with star'},{'time':.35,'effect':'soft spring landing'},{'time':.62,'effect':'logo chime 1'},{'time':1.04,'effect':'logo chime 2'},{'time':1.48,'effect':'logo chime 3'},{'time':1.92,'effect':'balloon sparkle, decay to end'}]},indent=2))
asset=B/'outro-with-star-sfx.mov';subprocess.run([FFMPEG,'-v','error','-y','-i',str(B/'outro.mov'),'-i',str(wav),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','pcm_s16le','-t','3.3',str(asset)],check=True)
items=[]
for m in json.load(open(O/'nanas-batch-manifest.json')):
 old=m['video'];s=old.removeprefix('nanas-').rsplit('-v',1)[0];v=m['version']+1;name=f'nanas-{s}-v{v}';out=O/(name+'.mp4');d=json.load(open(O/Path(old).with_suffix('.json')));e=d['edit'];T=sum(c['out']-c['in'] for c in e['clips'])
 subprocess.run([FFMPEG,'-v','error','-y','-i',str(O/old),'-i',str(wav),'-filter_complex',f'[0:a]atrim=end={T},asetpts=PTS-STARTPTS[a];[1:a]aresample=48000[b];[a][b]concat=n=2:v=0:a=1[m]','-map','0:v:0','-map','[m]','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(d['verification']['duration']),'-movflags','+faststart',str(out)],check=True)
 subprocess.run([FFMPEG,'-v','error','-i',str(out),'-f','null','-'],check=True)
 e['outro'].update(source='../media/brand/outro-with-star-sfx.mov',gain=1);e['previous_version']='../runs/'+old;e['review_notes'].append('Outro: whoosh de estrella, aterrizaje suave y campanillas de ensamblaje con cola hasta el final.');d['verification']['video_stream_copied_from']=old;d['output']=probe(out);d['outro_sound']={'asset':str(wav.relative_to(R)),'start':T,'duration':3.3};(O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2));(R/f'edits/{s}-v{v}.json').write_text(json.dumps(e,ensure_ascii=False,indent=2));build(out);items.append([s,v,m['title']]);print(name,flush=True)
(O/'catalog-reedit-items.json').write_text(json.dumps(items,ensure_ascii=False))
