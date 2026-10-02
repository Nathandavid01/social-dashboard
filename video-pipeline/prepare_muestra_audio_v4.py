#!/usr/bin/env python3
"""Normalize dialogue after the actual mono channel conversion used by this reel."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
recipe = json.loads((ROOT / 'edits/arecibo-muestra-0278-v3.json').read_text())
measured = json.loads((ROOT / 'runs/arecibo-muestra-voice-mono-analysis.json').read_text())
normalization = (
    'loudnorm=I=-16:TP=-2:LRA=7'
    f":measured_I={measured['input_i']}:measured_TP={measured['input_tp']}"
    f":measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}"
    f":offset={measured['target_offset']}:linear=false"
)
recipe['voice_filter'] = 'highpass=f=85,afftdn=nr=10:nf=-32:tn=1,aformat=channel_layouts=mono,' + normalization + ',aresample=48000'
recipe['music'].update({'source': '../media/music/arecibo-muestra-backbeat-v4.wav', 'target_lufs': -27.5})
recipe['review_notes'].append('v4 conserva imagen y timing v3; voz normalizada después de convertir a mono para evitar la pérdida de nivel al mezclar. Música medida en el mismo formato.')
duration = sum(c['out'] - c['in'] for c in recipe['clips'])
output = ROOT / 'edits/arecibo-muestra-0278-v4.json'
if output.exists():
    raise FileExistsError(output)
output.write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + '\n')
subprocess.run([
    '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '-v', 'error', '-n', '-ss', '4',
    '-i', str(ROOT / 'media/music/Backbeat.mp3'), '-t', str(duration),
    '-af', f'aformat=channel_layouts=mono,loudnorm=I=-27.5:TP=-8:LRA=7,afade=t=in:d=0.18,afade=t=out:st={duration-.45}:d=0.45',
    '-ar', '48000', str(ROOT / 'media/music/arecibo-muestra-backbeat-v4.wav'),
], check=True)
print(output)
