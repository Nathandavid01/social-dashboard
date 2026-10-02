"""Repair outdoor wind at source, before mixing music, without changing the picture."""
import copy
import hashlib
import json
import subprocess
from pathlib import Path

from pipeline import FFMPEG

R = Path(__file__).resolve().parent
OUT = R / 'runs'
MEDIA = R / 'media/arecibo'
WORK = OUT / 'arecibo-nuevo-lab-0281-v9-audio'
BASE_OLD = MEDIA / 'nuevo-lab-0281-0277-base-v4.mp4'
BASE_NEW = MEDIA / 'nuevo-lab-base-wind-v9.mov'
CLEAN = MEDIA / '0281-wind-clean-v9.wav'
VOICE = MEDIA / 'nuevo-lab-voice-wind-v9.wav'
MODEL = R / 'media/audio-models/sh.rnnn'
ORIGINAL = MEDIA / 'DJI_20260909093310_0281_D.MP4'
RATE = 48000
DELAY = 474 / RATE
CHAIN = 'pan=mono|c0=FL,aresample=48000,highpass=f=140:p=2,arnndn=m=media/audio-models/sh.rnnn:mix=0.96'


def run(args):
    return subprocess.run([FFMPEG, '-hide_banner', '-n', *args], cwd=R,
                          check=True, capture_output=True, text=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def outdoor(start, end, duration, dest):
    # Full-file denoising warms the model before each kept word. Compensate measured delay.
    trim = f'atrim=start={start+DELAY}:end={end+DELAY},asetpts=PTS-STARTPTS'
    if start < 2:
        trim += ',alimiter=limit=0.46:level=false:attack=3:release=80:latency=true'
    result = run(['-i', str(CLEAN), '-af', trim + ',loudnorm=I=-16:TP=-2:LRA=7:print_format=json',
                  '-f', 'null', '-'])
    s = result.stderr
    measure = json.loads(s[s.rfind('{'):s.rfind('}')+1])
    norm = ('loudnorm=I=-16:TP=-2:LRA=7:'
            f'measured_I={measure["input_i"]}:measured_TP={measure["input_tp"]}:'
            f'measured_LRA={measure["input_lra"]}:measured_thresh={measure["input_thresh"]}:'
            f'offset={measure["target_offset"]}:linear=false')
    filters = (f'{trim},{norm},aresample=48000,afade=t=in:d=0.008,'
               f'afade=t=out:st={end-start-.008}:d=0.008,apad,atrim=duration={duration}')
    run(['-v', 'error', '-i', str(CLEAN), '-af', filters, '-c:a', 'pcm_f32le', str(dest)])
    return {'source_in': start, 'source_out': end, 'timeline_duration': duration,
            'delay_compensation_samples': 474, 'normalization': measure}


def main():
    if any(p.exists() for p in (BASE_NEW, VOICE, R/'edits/arecibo-nuevo-lab-0281-v9.json')):
        raise FileExistsError('Numbered media versions are immutable')
    WORK.mkdir(exist_ok=True)
    if not CLEAN.exists():
        run(['-v', 'error', '-i', str(ORIGINAL), '-vn', '-af', CHAIN, '-c:a', 'pcm_f32le', str(CLEAN)])
    else:
        assert digest(CLEAN) == digest(OUT/'nuevo-0281-wind-clean-candidate.wav'), 'Unexpected partial-run audio'
    hook, inside, close = [WORK / f'{name}.wav' for name in ('hook', 'inside', 'close')]
    measurements = [outdoor(1.78, 4.26, 2.5, hook)]
    run(['-v', 'error', '-i', str(BASE_OLD), '-vn', '-af',
         'atrim=start=2.5:end=16.7,asetpts=PTS-STARTPTS', '-c:a', 'pcm_f32le', str(inside)])
    measurements.append(outdoor(10.28, 13.45, 3.2, close))
    run(['-v', 'error', '-i', str(hook), '-i', str(inside), '-i', str(close),
         '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]', '-map', '[a]',
         '-c:a', 'pcm_f32le', str(VOICE)])
    # Reuse existing frame-aligned base picture; retain lossless voice until final mix.
    run(['-v', 'error', '-i', str(BASE_OLD), '-i', str(VOICE), '-map', '0:v:0', '-map', '1:a:0',
         '-c:v', 'copy', '-c:a', 'pcm_s24le', '-t', '19.9', str(BASE_NEW)])
    recipe = json.loads((R/'edits/arecibo-nuevo-lab-0281-v8.json').read_text())
    recipe['previous_version'] = '../runs/arecibo-nuevo-lab-0281-v8.mp4'
    recipe['source'] = '../media/arecibo/' + BASE_NEW.name
    recipe['voice_filter'] = 'anull,aresample=48000'
    info = {'scope': 'Outdoor 0281 hook and location only', 'filter': CHAIN,
            'model': str(MODEL.relative_to(R)), 'model_sha256': digest(MODEL),
            'source_sha256': digest(ORIGINAL), 'delay_compensation_samples': 474,
            'rate': RATE, 'segments': measurements,
            'interior': 'Existing v4 voice retained without additional denoising',
            'hook_transient_control': '3ms lookahead peak limiter at0.46, latency compensated, before normalization; corrects v8 hook level shortfall',
            'voice_sha256': digest(VOICE), 'measurements_are_not_critical_listening': True}
    recipe['audio_revision'] = info
    for item, measurement in zip((recipe['source_segments'][0], recipe['source_segments'][2]), measurements):
        item['voice_measurement'] = measurement['normalization']
        item['wind_reduction'] = {'channel': 'FL', 'filter': CHAIN, 'delay_compensation_samples': 474}
    recipe['review_notes'].append('Usuario señala demasiado viento. v9 selecciona el canal FL de 0281, reduce viento desde el original con filtro de graves y RNNoise, compensa 474 muestras de retraso y normaliza por toma antes de música/efectos. Interior y montaje visual conservados; escucha crítica pendiente.')
    (R/'edits/arecibo-nuevo-lab-0281-v9.json').write_text(json.dumps(recipe, ensure_ascii=False, indent=2)+'\n')
    (OUT/'arecibo-nuevo-lab-0281-v9-wind-processing.json').write_text(json.dumps(info, ensure_ascii=False, indent=2)+'\n')
    print('Prepared v9: corrected outdoor voice, same picture, 19.9-second body.')


if __name__ == '__main__':
    main()
