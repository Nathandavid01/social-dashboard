from pathlib import Path
import json, subprocess, hashlib, wave, array, shutil, sys
from effects import sound_samples
from pipeline import probe
from review_loop import build
b=Path('/Volumes/Extreme SSD/Nate Media/mondays-rec-sept28/brand');v=sys.argv[1];dur=5.8;rate=48000;ff='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr[-2500:])
events=[{'preset':'impact','time':1.34,'duration':.28,'gain_db':-24},{'preset':'pop','time':1.65,'duration':.09,'gain_db':-29},{'preset':'pop','time':1.76,'duration':.09,'gain_db':-29},{'preset':'whoosh_sweep','time':1.95,'duration':.38,'gain_db':-25},{'preset':'impact','time':2.70,'duration':.28,'gain_db':-27}]
mix=[0]*round(rate*dur)
for e in events:
 for j,x in enumerate(sound_samples(e,rate)):mix[round(e['time']*rate)+j]+=x
synth=b/f'outro-{v}-timed-sfx.wav'
with wave.open(str(synth),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(array.array('h',[max(-32767,min(32767,x)) for x in mix]).tobytes())
lib=Path('/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array');db=json.loads((lib/'catalogo.json').read_text());music=next(a for a in db['assets'] if a['id']=='1298000');sfx=next(a for a in db['assets'] if a['id']=='619541');mf=music['files'][0];sf=sfx['files'][0]
for f in [mf,sf]:assert hashlib.sha256((lib/f['library_path']).read_bytes()).hexdigest()==f['sha256']
fc="[1:a]atrim=duration=5.8,asetpts=PTS-STARTPTS,volume=0.65,afade=t=in:d=0.045,afade=t=out:st=4.9:d=0.9[m];[2:a]volume=0.42,adelay=120|120[s];[3:a]volume=1.3[e];[m][s][e]amix=inputs=3:duration=first:normalize=0[a]"
prem=b/f'mondays-outro-standalone-{v}-premaster.mp4';out=b/f'mondays-outro-standalone-{v}.mp4'
run([ff,'-v','error','-n','-i',str(b/f'mondays-outro-visual-{v}.mp4'),'-ss','7.4','-i',str(lib/mf['library_path']),'-i',str(lib/sf['library_path']),'-i',str(synth),'-filter_complex',fc,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-t',str(dur),str(prem)])
run(['python3','audiokit.py','normalize',str(prem),str(out),'--target-lufs','-18']);run([ff,'-v','error','-i',str(out),'-f','null','-'])
for aid,f in [('1298000',mf),('619541',sf)]:
 u={'client':'Mondays Aguadilla','reel':'outro-standalone','version':v,'status':'usado_en_borrador_local','file_sha256':f['sha256'],'export':str(out),'action':'broadcast-style curved reveal and rhythmic type','critical_listening':'pending'};p=b/f'asset-use-standalone-{aid}-{v}.json';p.write_text(json.dumps(u,indent=2));run(['python3','scripts/motion_array_library.py','use',aid,str(p)])
edit={'client_id':'2b66e7f6-6993-4c12-9ff4-0279da4bf637','idea_id':'mondays-outro','catalog':'runs/mondays-catalog.json','references':{'brand_logo':str(b/'mondays-logo-recreated-v2.png'),'user_brand_reference':str(b/'mondays-brand-orange-reference.jpeg'),'palette':str(b/'official-pattern.jpg'),'phone':str(b/'v6-phone-provenance.json'),'previous':str(b/'mondays-outro-standalone-v6.mp4')},'review_notes':['User requested television commercial polish: 60fps custom motion, curved orange/yellow ribbons, sun retreat and orbit, logo reveal, timed slogan, phone pill and final legibility hold.','Standalone graphic outro: no raw footage/cuts/dialogue/B-roll changed; caption style unchanged.','Music/SFX verified hashes; licensed Motion Array evidence in library catalog. Original synthesized cues from pipeline Effect Kit. Critical listening and user approval pending.'],'sounds':events}
out.with_suffix('.json').write_text(json.dumps({'edit':edit,'style':{},'captions':[],'output':probe(out),'verification':{'full_decode':True}},indent=2));build(out)
shutil.copy2('scripts/render_mondays_brand.js',b/f'build-outro-{v}.js');shutil.copy2(__file__,b/f'finish-outro-{v}.py')
print(out)
