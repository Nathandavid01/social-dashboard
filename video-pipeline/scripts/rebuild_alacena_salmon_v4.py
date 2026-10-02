"""Fresh salmon plating timeline from original takes; preserve every prior export."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = Path('/Volumes/Extreme SSD/Nate Media/alacena-dashboard-20261001')
WORK = BASE / 'cocina-coctel-batch'
EVIDENCE = WORK / 'salmon-desde-cero-v4'
MEDIA = BASE / 'media/12594096'
LIB = Path('/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array')
FF = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
NAME = 'alacena-batch-cocina-coctel-batch-salmon-proceso-v4'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def run(args, name):
    with (EVIDENCE / name).open('w') as log:
        subprocess.run(args, stdout=log, stderr=log, check=True)

def main():
    EVIDENCE.mkdir(exist_ok=True)
    source = WORK / 'salmon-desde-cero-v4-source.mkv'
    music = WORK / 'salmon-desde-cero-v4-music.wav'
    recipe = ROOT / 'edits' / (NAME + '.json')
    output = WORK / (NAME + '.mp4')
    if any(p.exists() for p in (source, music, recipe, output)):
        raise RuntimeError('Preserve v4: use a new version instead of overwriting')
    shots = [
        {'id':'96d66f94-6a82-43ab-929f-50858bb64965', 'in':15.5, 'out':17.9, 'frames':63,
         'zoom':[1.025,1.065], 'focus':.72, 'action':'Chef places broccoli with the asparagus'},
        {'id':'96d66f94-6a82-43ab-929f-50858bb64965', 'in':28.35, 'out':30.9, 'frames':63,
         'zoom':[1.065,1.025], 'focus':.76, 'action':'Chef finishes vegetable arrangement with carrot'},
        {'id':'6cd0fe38-ca38-4a7f-9f43-0399b3e4bf8b', 'in':1.55, 'out':5.75, 'frames':123,
         'zoom':[1.015,1.045], 'focus':.59, 'action':'Complete salmon placement, from pan to vegetables'},
        {'id':'dfc7a4de-28b1-40e4-8a4c-c280f85d48a9', 'in':2.12, 'out':4.4, 'frames':83,
         'zoom':[1.0,1.025], 'focus':.6, 'action':'Garlic cream pours onto the plate; ends before contact with salmon'},
        {'id':'740230d8-9b5a-4ba4-9a65-a5513e00c6b8', 'in':11.5, 'out':14.5, 'frames':80,
         'zoom':[1.0,1.025], 'focus':.55, 'action':'Finished dish with microgreens; no knife'},
    ]
    inputs = [FF, '-hide_banner', '-nostdin', '-n', '-filter_complex_threads', '2']
    filters = []
    for i, s in enumerate(shots):
        p = MEDIA / (s['id'] + '.mp4')
        s.update(source=str(p), sha256=sha(p), duration=s['frames']/30)
        speed = (s['out']-s['in'])/s['duration']
        s['speed'] = speed
        inputs += ['-i', str(p)]
        progress = f'min(on/{s["frames"]-1},1)'
        a,b = s['zoom']
        z = f'{a}+({b}-{a})*({progress})*({progress})*(3-2*({progress}))'
        interpolation = 'minterpolate=fps=30:mi_mode=blend' if speed < .9 else 'fps=30'
        filters.append(f'[{i}:v]trim=start={s["in"]}:end={s["out"]},setpts=(PTS-STARTPTS)/{speed},'
                       f'{interpolation},scale=1620:2880,'
                       f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{s['focus']}':d=1:s=1080x1920:fps=30,"
                       f'tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame={s["frames"]},setpts=PTS-STARTPTS,'
                       f'eq=contrast=1.02:saturation=1.035:brightness=0.004,setsar=1,format=yuv420p,settb=1/30[v{i}]')
    length = shots[0]['duration']
    previous = 'v0'
    joins = []
    for i,s in enumerate(shots[1:],1):
        offset = round(length-.1,6)
        joins.append(round(offset+.05,6))
        filters.append(f'[{previous}][v{i}]xfade=transition=fade:duration=0.1:offset={offset}[m{i}]')
        length += s['duration']-.1
        previous = f'm{i}'
    outro = BASE / 'brand/outro-from-A1.mp4'
    inputs += ['-i',str(outro)]
    filters.append('[5:v]trim=start=0:end=0.2,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1,format=yuv420p,settb=1/30[brand]')
    filters.append(f'[{previous}][brand]xfade=transition=fade:duration=0.2:offset={round(length-.2,6)}[picture]')
    filters.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={length}[silent]')
    inputs += ['-filter_complex',';'.join(filters),'-map','[picture]','-map','[silent]',
               '-t',str(length),'-c:v','libx264','-crf','17','-preset','fast','-threads','4',
               '-c:a','pcm_s24le',str(source)]
    save(EVIDENCE/'shot-plan.json', {'shots':shots,'transitions':joins,'fresh_timeline':True,
         'source_note':'Cut cream pour before touching salmon; 4.4s end chosen after inspection at 0.4s intervals.',
         'source_catalog_correction':'The initial cream range falls on the plate; excluding the entire take was too broad.',
         'caption_choice':'Only a short opening in the existing approved Belleza profile; food remains visible afterward.'})
    run(inputs,'montage-render.log')
    body = float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(source)]))['format']['duration'])
    # The first .2s of the official outro already appear in the blend.
    tail = 2.78-.2
    total = body+tail
    catalog = json.loads((LIB/'catalogo.json').read_text())
    asset = next(a for a in catalog['assets'] if a['id']=='1126707')
    variant = next(f for f in asset['files'] if f['name']=='MA_KiwiAudio_FunkyWrapper_Main.wav')
    original = LIB / variant['library_path']
    assert sha(original)==variant['sha256']
    music_in = 5.507
    run([FF,'-v','error','-nostdin','-n','-i',str(original),'-af',
         f'atrim=start={music_in}:duration={total},asetpts=PTS-STARTPTS,afade=t=in:d=0.06,afade=t=out:st={total-.9}:d=0.9',
         '-ar','48000','-ac','2','-c:a','pcm_s24le',str(music)],'music-render.log')
    edit = {
        'idea_id':'a09caccc-3639-4259-9d70-102ce2112360',
        'client_id':'12594096-5bc6-4d43-9dea-11cbd7892771',
        'title':'El chef emplata el salmón · desde cero',
        'source':str(source),'style':'../styles/alacena-v2.json',
        'catalog':'runs/alacena-catalog.json','caption_mode':'editorial',
        'clips':[{'in':0,'out':body,'audio_edge_fade':.02}],
        'captions':[{'start':.12,'end':1.18,'text':'Así emplatamos'},
                    {'start':1.2,'end':2.6,'text':'nuestro salmón'}],
        'broll':[], 'effects':[], 'transitions':[],
        'sounds':[{'kind':'click','time':t,'duration':.035,'gain_db':-34} for t in joins],
        'audio_master':{'mode':'music'},
        'music':{'source':str(music),'extend_through_outro':True,'license':'Motion Array paid subscription',
                 'license_evidence':str(WORK/'salmon-proceso-music-provenance.json')},
        'outro':{'source':str(outro),'in':.2,'out':2.78,'gain':0},
        'references':{'A1':str(BASE.parent/'alacena-audit-20260930/edited/A1.mov'),
                      'visual_comparison':str(BASE/'reference.jpg')},
        'review_notes':[
            'Rebuilt from original takes, no prior rendered montage used. New chronological food narrative: vegetables, fish placement, cream onto plate, finished garnish detail.',
            'Cream segment ends at original 4.4 seconds, before droplets hit the fish. Prior whole-take exclusion corrected to a range-specific restriction. Kitchen direction chatter muted.',
            'Opening captions retain the Alacena profile; subsequent action and food remain without overlays. Music remains unique to this Alacena reel, with a new excerpt; onset estimate near 90 BPM guides changes at 2, 4, 8 and 10.67 seconds.',
            'Full current Drive inventory unavailable. Live dashboard and SSD checked; older Drive-derived local candidates and source transcripts consulted. Listening and client approval remain separate gates.'
        ]
    }
    save(recipe,edit)
    save(EVIDENCE/'music-use.json',{'client':'alacena','reel':edit['idea_id'],'version':'v4',
         'status':'used_in_local_draft','file_sha256':variant['sha256'],'variant':variant['name'],
         'range':[music_in,music_in+total],'export':str(output),'gain':'Audio Kit music mode',
         'reason':'Reuse this reel unique track, new excerpt and fades, no download'})
    print(json.dumps({'recipe':str(recipe),'output':str(output),'duration':total}))

if __name__ == '__main__':
    main()
