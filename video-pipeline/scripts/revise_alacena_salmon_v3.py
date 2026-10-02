"""Build a new, action-led salmon plating review without replacing v2."""
import copy
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = Path('/Volumes/Extreme SSD/Nate Media/alacena-dashboard-20261001')
WORK = BASE / 'cocina-coctel-batch'
EVIDENCE = WORK / 'salmon-mejora-v3'
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
NAME = 'alacena-batch-cocina-coctel-batch-salmon-proceso-v3'
SOURCE = WORK / 'salmon-proceso-v3-source.mkv'
MUSIC = WORK / 'salmon-proceso-v3-music.wav'
RECIPE = ROOT / 'edits' / (NAME + '.json')

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def run(args, log):
    with log.open('w') as f:
        subprocess.run(args, check=True, stdout=f, stderr=f)

def main():
    if any(p.exists() for p in [MUSIC, RECIPE, WORK / (NAME + '.mp4')]):
        raise RuntimeError('v3 exists; preserve it and use another version')
    EVIDENCE.mkdir(exist_ok=True)
    media = BASE / 'media/12594096'
    # Opening and closing use different ranges of the same take, never a loop.
    shots = [
        dict(id='6cd0fe38-ca38-4a7f-9f43-0399b3e4bf8b', start=7.2, end=8.4,
             speed=1, zoom=[1.015, 1.045], focus=.58, purpose='opening product reveal'),
        dict(id='96d66f94-6a82-43ab-929f-50858bb64965', start=3.3, end=5.45,
             speed=1.25, zoom=[1.10, 1.14], focus=.78, purpose='carrot placement'),
        dict(id='96d66f94-6a82-43ab-929f-50858bb64965', start=6.45, end=9.65,
             speed=1.45, zoom=[1.13, 1.09], focus=.78, purpose='asparagus placement'),
        dict(id='6cd0fe38-ca38-4a7f-9f43-0399b3e4bf8b', start=1.8, end=5.45,
             speed=1.15, zoom=[1.04, 1.07], focus=.61, purpose='salmon lowered onto vegetables'),
        dict(id='6cd0fe38-ca38-4a7f-9f43-0399b3e4bf8b', start=9.2, end=12.1,
             speed=1, zoom=[1.015, 1.04], focus=.58, purpose='clean final dish, no knife or sauce pour'),
    ]
    transition = .10
    args = [FFMPEG, '-hide_banner', '-nostdin', '-n', '-filter_complex_threads', '2']
    filters = []
    for i, s in enumerate(shots):
        p = media / (s['id'] + '.mp4')
        assert p.is_file()
        s['source'] = str(p)
        s['source_sha256'] = digest(p)
        s['duration'] = round((s['end'] - s['start']) / s['speed'] * 30) / 30
        args += ['-i', str(p)]
        n = max(1, round(s['duration'] * 30) - 1)
        a, b = s['zoom']
        progress = f'min(on/{n},1)'
        z = f'{a}+({b}-{a})*({progress})*({progress})*(3-2*({progress}))'
        filters.append(
            f'[{i}:v]trim=start={s["start"]}:end={s["end"]},'
            f'setpts=(PTS-STARTPTS)/{s["speed"]},fps=30,scale=1620:2880,'
            f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{s['focus']}':d=1:s=1080x1920:fps=30,"
            f'trim=duration={s["duration"]},setpts=PTS-STARTPTS,'
            f'eq=contrast=1.025:saturation=1.045:brightness=0.003,'
            f'setsar=1,format=yuv420p,settb=1/30[v{i}]')
    length = shots[0]['duration']
    previous = 'v0'
    joins = []
    for i, s in enumerate(shots[1:], 1):
        offset = round(length - transition, 6)
        joins.append(offset + transition / 2)
        filters.append(f'[{previous}][v{i}]xfade=transition=fade:duration={transition}:offset={offset}[m{i}]')
        length += s['duration'] - transition
        previous = f'm{i}'
    # Blend into the exact first frame of the official outro; the pipeline then
    # continues its original animation without a harsh product-to-brand cut.
    outro = BASE / 'brand/outro-from-A1.mp4'
    args += ['-i', str(outro)]
    filters.append(f'[5:v]trim=start=0:end=0.2,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1,format=yuv420p,settb=1/30[brand]')
    filters.append(f'[{previous}][brand]xfade=transition=fade:duration=0.2:offset={round(length-.2,6)}[picture]')
    filters.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={length}[silent]')
    args += ['-filter_complex', ';'.join(filters), '-map', '[picture]', '-map', '[silent]',
             '-t', str(length), '-c:v', 'libx264', '-crf', '17', '-preset', 'fast',
             '-threads', '4', '-c:a', 'pcm_s24le', str(SOURCE)]
    if not SOURCE.exists():
        run(args, EVIDENCE / 'montage-render.log')
    actual = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(SOURCE)]))
    body = float(actual['format']['duration'])
    total = body + 2.78
    library = Path('/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array')
    catalog = json.loads((library / 'catalogo.json').read_text())
    asset = next(a for a in catalog['assets'] if a['id'] == '1126707')
    variant = next(f for f in asset['files'] if f['name'] == 'MA_KiwiAudio_FunkyWrapper_Main.wav')
    music_original = library / variant['library_path']
    assert digest(music_original) == variant['sha256']
    run([FFMPEG, '-v', 'error', '-nostdin', '-n', '-i', str(music_original),
         '-af', f'atrim=duration={total},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st={total-.8}:d=0.8',
         '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', str(MUSIC)], EVIDENCE / 'music-render.log')
    edit = copy.deepcopy(json.loads((ROOT / 'edits' / 'alacena-batch-cocina-coctel-batch-salmon-proceso-v2.json').read_text()))
    edit.update(source=str(SOURCE), title='El chef emplata el salmón', transcript=None,
                clips=[dict(**{'in': 0, 'out': body}, audio_edge_fade=.02)],
                captions=[dict(start=.1, end=2.5, text='Emplatamos el salmón'),
                          dict(start=3.1, end=5.9, text='El toque del chef'),
                          dict(start=7.8, end=9.5, text='Listo para tu mesa')],
                sounds=[dict(kind='click', time=round(t,3), duration=.04, gain_db=-32) for t in joins],
                effects=[], transitions=[], broll=[])
    edit['music'].update(source=str(MUSIC))
    edit['review_notes'] = [
        'User-requested editing improvement: action-led 5-shot montage, tighter vegetable framing, gentle speed changes, brief dissolves, clean nonrepeated dish reveal. Same approved Alacena caption typography and official outro.',
        'Keep the recorded instruction: no sauce touching the salmon. Knife close-up and previously reused hero omitted. Distinct source ranges, original production chatter muted.',
        'Six dashboard originals checked against SSD copies. Drive searches empty and metadata read unavailable; current complete Drive coverage is not claimed. Critical listening and human approval pending.'
    ]
    RECIPE.write_text(json.dumps(edit, ensure_ascii=False, indent=2))
    (EVIDENCE / 'source-plan.json').write_text(json.dumps(dict(shots=shots, dissolves=joins,
        body_duration=body, final_expected=total, preserved_version='v2',
        dashboard=json.loads(Path('/tmp/alacena-salmon-live.json').read_text()),
        drive='Alacena and A la Cena searches empty; prior inventory file metadata inaccessible',
        excluded=dict(dfc7a4de='sauce pour forbidden by shooting note',
                      b949cd1c='knife enters hero; replace with clean range',
                      **{'740230d8':'sauce already applied; omit for process continuity',
                         '89c817a7':'used in chef experience; preserve its reservation'})),ensure_ascii=False,indent=2))
    use = dict(client='alacena', reel=edit['idea_id'], version='v3', status='used_in_local_draft',
               file_sha256=variant['sha256'], variant=variant['name'], range=[0,total],
               gain='audio-master music mode', fades=dict(start=.08,end=.8), export=str(WORK/(NAME+'.mp4')))
    (WORK / 'salmon-proceso-music-use-v3.json').write_text(json.dumps(use,ensure_ascii=False,indent=2))
    print(json.dumps(dict(recipe=str(RECIPE), output=str(WORK/(NAME+'.mp4')),body=body,total=total)))

if __name__ == '__main__':
    main()
