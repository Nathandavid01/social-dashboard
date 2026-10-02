"""Preserve v4 and restore the knife shot with its synchronous production sound."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = Path('/Volumes/Extreme SSD/Nate Media/alacena-dashboard-20261001')
WORK = BASE / 'cocina-coctel-batch'
BATCH = WORK / 'salmon-cuchillo-v5'
MEDIA = BASE / 'media/12594096'
LIB = Path('/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array')
FF = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
NAME = 'alacena-batch-cocina-coctel-batch-salmon-proceso-v5'


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def run(args, name):
    with (BATCH / name).open('w') as log:
        subprocess.run(args, stdout=log, stderr=log, check=True)


def main():
    source = WORK / 'salmon-cuchillo-v5-source.mkv'
    music = WORK / 'salmon-cuchillo-v5-music.wav'
    if source.exists() or music.exists():
        raise RuntimeError('Preserve all versions; output already exists')
    old = json.loads((ROOT / 'edits' / (NAME.replace('v5', 'v4') + '.json')).read_text())
    shots = json.loads((WORK / 'salmon-desde-cero-v4/shot-plan.json').read_text())['shots']
    shots.insert(4, {'id': 'b949cd1c-d661-4bbf-9d5d-a17663cd37bd', 'in': 0,
                    'out': 130/30, 'frames': 130, 'zoom': [1.0, 1.015], 'focus': .55,
                    'action': 'Knife scraping the salmon, synchronous original audio, natural speed'})
    inputs = [FF, '-hide_banner', '-nostdin', '-n', '-filter_complex_threads', '2']
    filters, joins = [], []
    length = 0
    for i, s in enumerate(shots):
        path = MEDIA / (s['id'] + '.mp4')
        s.update(source=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                 duration=s['frames']/30, timeline_in=round(length - (.1 if i else 0), 6))
        speed = (s['out']-s['in'])/s['duration']
        s['speed'] = speed
        length = s['timeline_in'] + s['duration']
        inputs += ['-i', str(path)]
        progress = f'min(on/{s["frames"]-1},1)'
        a, b = s['zoom']
        z = f'{a}+({b}-{a})*({progress})*({progress})*(3-2*({progress}))'
        interpolation = 'minterpolate=fps=30:mi_mode=blend' if speed < .9 else 'fps=30'
        filters.append(f'[{i}:v]trim=start={s["in"]}:end={s["out"]},setpts=(PTS-STARTPTS)/{speed},'
                       f'{interpolation},scale=1620:2880,'
                       f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*{s['focus']}':d=1:s=1080x1920:fps=30,"
                       f'tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame={s["frames"]},setpts=PTS-STARTPTS,'
                       f'eq=contrast=1.02:saturation=1.035:brightness=0.004,setsar=1,format=yuv420p,settb=1/30[v{i}]')
        if i:
            prev = 'v0' if i == 1 else f'm{i-1}'
            filters.append(f'[{prev}][v{i}]xfade=transition=fade:duration=0.1:offset={s["timeline_in"]}[m{i}]')
            joins.append(round(s['timeline_in']+.05, 6))
    outro = BASE / 'brand/outro-from-A1.mp4'
    inputs += ['-i', str(outro)]
    filters.append('[6:v]trim=start=0:end=0.2,setpts=PTS-STARTPTS,fps=30,scale=1080:1920,setsar=1,format=yuv420p,settb=1/30[brand]')
    filters.append(f'[m5][brand]xfade=transition=fade:duration=0.2:offset={round(length-.2,6)}[picture]')
    knife = shots[4]
    # Timing remains one-to-one with the original image; the limiter compensates its latency.
    audio_filter = (f'atrim=start=0:end={knife["duration"]},asetpts=PTS-STARTPTS,aresample=48000,'
                    f'highpass=f=85,volume=14dB,alimiter=limit=0.8:level=false:latency=true,'
                    f'afade=t=in:d=0.01,afade=t=out:st={knife["duration"]-.16}:d=0.16')
    filters.append(f'[4:a]{audio_filter},adelay={round(knife["timeline_in"]*48000)}S:all=1,'
                   f'apad,atrim=duration={length}[location]')
    inputs += ['-filter_complex', ';'.join(filters), '-map', '[picture]', '-map', '[location]',
               '-t', str(length), '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', '-threads', '4',
               '-c:a', 'pcm_s24le', str(source)]
    save(BATCH / 'shot-plan.json', {'shots': shots, 'transitions': joins,
         'based_on': str(WORK / 'salmon-desde-cero-v4/shot-plan.json'),
         'change': 'Insert original knife shot after cream, before finished garnish; retain all other v4 shots',
         'source_audio': {'source': knife['source'], 'range': [0, knife['duration']],
                          'timeline_in': knife['timeline_in'], 'speed': 1,
                          'filter': audio_filter, 'critical_listening': 'pending'}})
    run(inputs, 'montage-render.log')
    body = float(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(source)]))['format']['duration'])
    total = body + 2.78 - .2
    catalog = json.loads((LIB / 'catalogo.json').read_text())
    asset = next(a for a in catalog['assets'] if a['id'] == '1126707')
    variant = next(f for f in asset['files'] if f['name'] == 'MA_KiwiAudio_FunkyWrapper_Main.wav')
    original = LIB / variant['library_path']
    assert hashlib.sha256(original.read_bytes()).hexdigest() == variant['sha256']
    start, end = knife['timeline_in'], knife['timeline_in'] + knife['duration']
    ramp_in, ramp_out, duck = .35, .6, -28
    db = (f'if(lt(t,{start-ramp_in}),0,if(lt(t,{start}),{duck}*(t-{start-ramp_in})/{ramp_in},'
          f'if(lt(t,{end}),{duck},if(lt(t,{end+ramp_out}),{duck}*(1-(t-{end})/{ramp_out}),0))))')
    music_filter = (f"atrim=start=5.507:duration={total},asetpts=PTS-STARTPTS,"
                    f"volume='pow(10,({db})/20)':eval=frame,afade=t=in:d=0.06,"
                    f'afade=t=out:st={total-.9}:d=0.9')
    run([FF, '-v', 'error', '-nostdin', '-n', '-i', str(original), '-af', music_filter,
         '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', str(music)], 'music-render.log')
    transcript = BATCH / 'editorial-titles.json'
    save(transcript, {'file': str(source), 'text': '', 'segments': [], 'caption_mode': 'editorial',
                     'note': 'Editorial title placeholder, not an inferred or audited speech transcript.'})
    selection = json.loads((WORK / 'selection.json').read_text())[0]
    selection.update(source=str(source), transcript=str(transcript), title='El chef emplata el salmón · cuchillo audible')
    save(BATCH / 'selection.json', [selection])
    decision = {k: old[k] for k in ('captions', 'broll', 'effects', 'audio_master', 'caption_mode')}
    decision.update(id='salmon-proceso', clips=[{'in': 0, 'out': body, 'audio_edge_fade': .02}],
                    sounds=[{'kind': 'click', 'time': t, 'duration': .035, 'gain_db': -34} for t in joins[:3]],
                    music={**old['music'], 'source': str(music)},
                    editorial_note='v5: restore source knife image and original sound at natural speed, after cream; duck music 28dB with smooth ramps. No synthetic effects over the scraping. Retain v4 captions and other shots. Critical listening pending; local draft.')
    save(BATCH / 'decisions.json', [decision])
    save(BATCH / 'music-use.json', {'client': 'alacena', 'reel': old['idea_id'], 'version': 'v5',
         'status': 'used_in_local_draft', 'file_sha256': variant['sha256'], 'variant': variant['name'],
         'range': [5.507, 5.507+total], 'export': str(WORK / (NAME+'.mp4')),
         'ducking': {'in': start, 'out': end, 'gain_db': duck, 'attack_seconds': ramp_in, 'release_seconds': ramp_out},
         'reason': 'Keep same reel track; lower only for original synchronous knife sound'})
    print(json.dumps({'body': body, 'total': total, 'knife_in': start, 'knife_out': end}))


if __name__ == '__main__':
    main()
