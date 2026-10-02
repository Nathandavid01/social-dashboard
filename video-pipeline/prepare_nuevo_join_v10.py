"""Restore the doctor's natural lead-in and soften the speaker handoff."""
import copy
import json
import subprocess
from pathlib import Path
from pipeline import FFMPEG, cut_words

R = Path(__file__).resolve().parent
M = R / 'media/arecibo'
O = R / 'runs'
OLD = M / 'nuevo-lab-base-wind-v9.mov'
DOCTOR = M / 'DJI_20260909092343_0277_D.MP4'
BASE = M / 'nuevo-lab-natural-join-v10.mov'
VOICE = M / 'nuevo-lab-voice-join-v10.wav'
WORK = O / 'arecibo-nuevo-lab-0281-v10-prepare'
PRE = 'aformat=channel_layouts=mono,highpass=f=85,afftdn=nr=10:nf=-32:tn=1'
START, END, DELTA = 6.70, 21.50, 0.60


def run(args):
    p = subprocess.run([FFMPEG, '-hide_banner', '-n', *args], cwd=R,
                       capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-4000:])
    return p


def main():
    if BASE.exists() or VOICE.exists():
        raise FileExistsError('Preserve numbered versions')
    WORK.mkdir(exist_ok=True)
    trim = f'atrim=start={START}:end={END},asetpts=PTS-STARTPTS,{PRE}'
    p = run(['-i', str(DOCTOR), '-vn', '-af', trim+',loudnorm=I=-16:TP=-2:LRA=7:print_format=json', '-f','null','-'])
    s = p.stderr
    measured = json.loads(s[s.rfind('{'):s.rfind('}')+1])
    norm = ('loudnorm=I=-16:TP=-2:LRA=7:'
            f'measured_I={measured["input_i"]}:measured_TP={measured["input_tp"]}:'
            f'measured_LRA={measured["input_lra"]}:measured_thresh={measured["input_thresh"]}:'
            f'offset={measured["target_offset"]}:linear=false')
    doctor_audio = WORK/'doctor.wav'
    run(['-v','error','-i',str(DOCTOR),'-vn','-af',trim+','+norm+
         ',aresample=48000,afade=t=in:d=0.008,afade=t=out:st=14.792:d=0.008,apad,atrim=duration=14.8',
         '-c:a','pcm_f32le',str(doctor_audio)])
    # The two already repaired outdoor voice segments are reused exactly.
    run(['-v','error','-i',str(M/'nuevo-lab-voice-wind-v9.wav'),'-i',str(doctor_audio),
         '-filter_complex','[0:a]atrim=start=0:end=2.5,asetpts=PTS-STARTPTS[a];'
         '[0:a]atrim=start=16.7:end=19.9,asetpts=PTS-STARTPTS[c];'
         '[a][1:a][c]concat=n=3:v=0:a=1[out]', '-map','[out]','-c:a','pcm_f32le',str(VOICE)])
    # Three-frame handles hold only during the silent handoff. After the dissolve,
    # doctor picture and sound retain the same time mapping: source6.7 -> timeline2.5.
    filters = [
        '[0:v]trim=start=0:end=2.5,setpts=PTS-STARTPTS,fps=30,settb=AVTB,tpad=stop_mode=clone:stop_duration=0.1[a]',
        '[1:v]trim=start=6.7:end=21.5,setpts=PTS-STARTPTS,fps=30,'
        'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,'
        'settb=AVTB,tpad=start_mode=clone:start_duration=0.1[b]',
        '[a][b]xfade=transition=fade:duration=0.2:offset=2.4,trim=duration=17.3,setpts=PTS-STARTPTS[joined]',
        '[0:v]trim=start=16.7:end=19.9,setpts=PTS-STARTPTS,fps=30,settb=AVTB[c]',
        '[joined][c]concat=n=2:v=1:a=0,format=yuv420p[v]',
    ]
    run(['-v','error','-filter_complex_threads','2','-i',str(OLD),'-i',str(DOCTOR),'-i',str(VOICE),
         '-filter_complex',';'.join(filters),'-map','[v]','-map','2:a:0',
         '-c:v','libx264','-preset','fast','-crf','17','-threads','4',
         '-c:a','pcm_s24le','-t','20.5',str(BASE)])
    recipe = json.loads((R/'edits/arecibo-nuevo-lab-0281-v9.json').read_text())
    recipe['source'] = '../media/arecibo/'+BASE.name
    recipe['previous_version'] = '../runs/arecibo-nuevo-lab-0281-v9.mp4'
    recipe['clips'] = [
        {'in':0,'out':11.92,'zoom_keyframes':[{'time':0,'zoom':1},{'time':11.92,'zoom':1.045}]},
        {'in':11.92,'out':17.3,'zoom_keyframes':[{'time':0,'zoom':1.055},{'time':5.38,'zoom':1.035}]},
        {'in':17.3,'out':20.5},
    ]
    for layer in recipe['broll']:
        layer['at'] = round(layer['at']+DELTA,3)
    recipe['sounds'] = [sound for sound in recipe['sounds'] if sound['time'] != 2.5]
    for sound in recipe['sounds']:
        sound['time'] = round(sound['time']+DELTA,3)
    for caption in recipe['captions']:
        if caption['start'] >= 2.5:
            caption['start'] = round(caption['start']+DELTA,3)
            caption['end'] = round(caption['end']+DELTA,3)
    recipe['captions'].append({'start':2.74,'end':3.18,'text':'PUES, MIRA'})
    recipe['captions'].sort(key=lambda c:c['start'])
    segments = recipe['source_segments']
    segments[1].update({'in':START,'timeline_duration':14.8,'voice_measurement':measured})
    segments[2]['timeline_start'] = 17.3
    old_transcript = json.loads((O/'arecibo-nuevo-lab-v4-transcript.json').read_text())
    words = copy.deepcopy([w for s in old_transcript['segments'] for w in s['words'] if w['end'] <= 2.5])
    raw = json.loads((R.parent/'arecibo-lab-video/transcripts/0277.json').read_text())
    dw = cut_words([w for s in raw['segments'] for w in s['words']], [{'in':START,'out':END}])
    for w in dw:
        w['start'] = round(w['start']+2.5,3)
        w['end'] = round(w['end']+2.5,3)
        words.append(w)
    for w in [w for s in old_transcript['segments'] for w in s['words'] if w['start'] >= 16.7]:
        item = copy.deepcopy(w)
        item['start'] = round(item['start']+DELTA,3)
        item['end'] = round(item['end']+DELTA,3)
        words.append(item)
    transcript_path = O/'arecibo-nuevo-lab-v10-transcript.json'
    transcript_path.write_text(json.dumps({'segments':[{'words':words}],'source_segments':segments},ensure_ascii=False,indent=2)+'\n')
    recipe['transcript'] = '../runs/'+transcript_path.name
    music = R/'media/music/arecibo-nuevo-lab-be-chillin-v10.wav'
    run(['-v','error','-ss','5','-i',str(R/'media/music/Be Chillin.mp3'),'-t','20.5','-af',
         'aformat=channel_layouts=mono,loudnorm=I=-28.5:TP=-8:LRA=7,afade=t=in:d=0.12,afade=t=out:st=20.05:d=0.45',
         '-ar','48000',str(music)])
    recipe['music']['source'] = '../media/music/'+music.name
    recipe['speaker_handoff'] = {'requested':'El cambio hombre a mujer es muy abrupto',
        'restored_words':'Pues, mira','doctor_source_start':START,
        'spoken_gap_seconds':0.26,'visual_dissolve':[2.4,2.6],
        'transition_sound':'removed','body_duration':20.5,'total_duration':23.0,
        'outdoor_audio':'Exact PCM voice reused from v9; wind correction retained'}
    recipe['review_notes'].append('v10 restaura Pues, mira y su entrada natural. Pausa entre voces de0.26s, disolvencia6fotogramas en el cambio, sin whoosh. Zoom continuo sobre la unión. Desplazar captions/B-roll/efectos0.60s y extender música. Conservar voz exterior corregida de v9.')
    (R/'edits/arecibo-nuevo-lab-0281-v10.json').write_text(json.dumps(recipe,ensure_ascii=False,indent=2)+'\n')
    print('Prepared v10,23.0seconds,restored lead-in and6frame dissolve.')


if __name__ == '__main__':
    main()
