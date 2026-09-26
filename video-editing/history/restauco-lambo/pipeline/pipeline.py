#!/usr/bin/env python3
"""Local AI-assisted editing: transcribe -> editable timeline -> reproducible render."""
import argparse
import array
import hashlib
import json
import math
import os
import random
from pathlib import Path
import shutil
import subprocess
import wave
from effects import SOUNDS, validate_event, sound_samples, visual_filter, layer_fade_filter

ROOT = Path(__file__).resolve().parent
FFMPEG = os.environ.get('FFMPEG', '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg')


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))


def validate_edit(clips, duration):
    if not clips:
        raise ValueError('La edición necesita al menos un corte')
    for clip in clips:
        a, b = clip['in'], clip['out']
        if not all(isinstance(t, (int, float)) and math.isfinite(t) for t in (a, b)) or not 0 <= a < b <= duration:
            raise ValueError('Corte fuera de la duración del original')
        if not 1 <= clip.get('zoom', 1) <= 1.3:
            raise ValueError('Zoom fuera del rango 1–1.3')


def validate_broll(layer, source_duration, timeline_duration):
    validate_edit([layer], source_duration)
    at = layer['at']
    if not isinstance(at, (int, float)) or not math.isfinite(at) or not 0 <= at < timeline_duration or at + layer['out'] - layer['in'] > timeline_duration + .01:
        raise ValueError('B-roll fuera de la edición')


def zoom_filter(layer):
    keys = layer.get('zoom_keyframes')
    if not keys:
        return 'null'
    duration = layer['out'] - layer['in']
    if len(keys) != 2 or abs(keys[0]['time']) > .001 or abs(keys[1]['time'] - duration) > .001:
        raise ValueError('Zoom requiere keyframes al inicio y al final del plano')
    values = [k['zoom'] for k in keys]
    if not all(isinstance(v, (int, float)) and math.isfinite(v) and 1 <= v <= 1.2 for v in values):
        raise ValueError('Zoom fuera de 1–1.2')
    frames = max(1, round(duration * 30) - 1)
    progress = f'min(on/{frames},1)'
    # Smoothstep eases into and out of the two keyframes.
    expression = f'{values[0]}+({values[1]}-{values[0]})*({progress})*({progress})*(3-2*({progress}))'
    return f"scale=1620:2880,zoompan=z='{expression}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30"


def cut_words(words, clips):
    result, offset = [], 0
    for clip in clips:
        a, b = clip['in'], clip['out']
        for word in words:
            if word['end'] <= a or word['start'] >= b:
                continue
            if word['start'] < a - .015 or word['end'] > b + .015:
                raise ValueError('El corte atraviesa una palabra: ' + word['word'])
            result.append({**word, 'start': round(max(0, word['start'] - a) + offset, 3),
                           'end': round(min(b, word['end']) - a + offset, 3)})
        offset += b - a
    return result


def group_captions(words, max_words=3, max_chars=22):
    groups, current = [], []
    def emit():
        if current:
            groups.append({'start': current[0]['start'], 'end': current[-1]['end'],
                           'text': ' '.join(w['word'].strip() for w in current).upper()})
    for word in words:
        if not word['word'].strip() or word['end'] <= word['start']:
            continue
        if current and (len(current) >= max_words or
                        len(' '.join(w['word'].strip() for w in current + [word])) > max_chars or
                        word['start'] - current[-1]['end'] > .35 or
                        current[-1]['word'].rstrip().endswith(('.', '?', '!', ',', ':'))):
            emit()
            current = []
        current.append(word)
    emit()
    for i, group in enumerate(groups):
        limit = groups[i + 1]['start'] if i + 1 < len(groups) else group['end'] + .1
        group['end'] = min(group['end'] + .1, limit)
    return groups


def ass_escape(text):
    return text.replace('\\', '').replace('{', '(').replace('}', ')').replace('\n', ' ').replace('\r', ' ').replace('’', "'").replace('‘', "'")


def ass_time(t):
    cs = round(t * 100)
    return f'{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}'


def wrap_balanced(text, font, limit):
    """Una línea si cabe; si no, dos líneas lo más parejas posible sin dejar una palabra huérfana; tres solo si es inevitable."""
    words = text.split()
    if font.getlength(text) <= limit:
        return [text]
    best = None
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:])
        wa, wb = font.getlength(a), font.getlength(b)
        if wa <= limit and wb <= limit:
            score = abs(wa - wb) + (400 if len(words) > 3 and min(i, len(words) - i) == 1 else 0)
            if best is None or score < best[0]:
                best = (score, [a, b])
    if best:
        return best[1]
    lines, line = [], ''
    for w in words:
        candidate = (line + ' ' + w).strip()
        if line and font.getlength(candidate) > limit:
            lines.append(line)
            line = w
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines

def write_ass(captions, style, output, font_file):
    from PIL import ImageFont
    font = ImageFont.truetype(str(font_file), style['font_size'])
    header = f'''[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Nana,{style['font_family']},{style['font_size']},{style.get('primary_colour', '&H00FFFFFF')},{style.get('primary_colour', '&H00FFFFFF')},{style.get('outline_colour', '&H008600C8')},{style.get('back_colour', '&H408600C8')},{style.get('bold', 0)},0,0,0,100,100,0,0,{style.get('border_style', 1)},{style.get('outline', 4)},{style.get('shadow', 2)},2,{style.get('margin_x', 100)},{style.get('margin_x', 100)},{style['bottom_margin']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    for c in captions:
        # Brief scale-in on each phrase; readable full phrase for the remaining duration.
        caption_font = ImageFont.truetype(c['font_file'], style['font_size']) if c.get('font_file') else font
        lines = c['text'].split('\n')
        if style.get('fixed_size'):
            # Clientes con tamaño fijo (Arecibo Lab): nunca encoger; partir en líneas balanceadas.
            lines = [l for src in lines for l in wrap_balanced(src, caption_font, style.get('wrap_width', 950))]
        text = r'\N'.join(ass_escape(line) for line in lines)
        width = max(caption_font.getlength(ass_escape(line)) for line in lines)
        size = style['font_size'] if style.get('fixed_size') else min(style['font_size'], math.floor(style['font_size'] * 820 / max(1, width)))
        animation = r'{\fs' + str(size) + '}'
        if style.get('caption_animation', 'scale') == 'scale':
            animation = r'{\fs' + str(size) + r'\fscx94\fscy94\t(0,90,\fscx100\fscy100)}'
        if c.get('font_family'):
            animation = r'{\fn' + ass_escape(c['font_family']) + r'\b1}' + animation
        header += f"Dialogue: 0,{ass_time(c['start'])},{ass_time(c['end'])},Nana,,0,0,0,,{animation}{text}\n"
    output.write_text(header, encoding='utf-8')


def synth_sounds(path, duration, events):
    rate = 48000
    samples = array.array('h', [0]) * math.ceil(duration * rate)
    rng = random.Random(741)
    for event in events:
        if event.get('preset'):
            event = validate_event(event, duration)
            start = round(event['time'] * rate)
            for i, value in enumerate(sound_samples(event, rate)):
                if start+i < len(samples):
                    samples[start+i] = max(-32767, min(32767, samples[start+i] + value))
            continue
        start = round(event['time'] * rate)
        kind = event.get('kind', 'click')
        if kind not in ('click', 'whoosh'):
            raise ValueError('Tipo de sonido desconocido')
        length = round(event.get('duration', .045 if kind == 'click' else .22) * rate)
        gain = 10 ** (event.get('gain_db', -24) / 20)
        previous = 0
        for i in range(length):
            pos = start + i
            if pos >= len(samples):
                break
            t = i / rate
            noise = rng.uniform(-1, 1)
            high = (noise - previous) * .5
            previous = noise
            if kind == 'click':
                # Short broadband mechanical click with a quieter release tick.
                envelope = math.exp(-t * 260) + .24 * math.exp(-abs(t-.018)*600)
                signal = high * envelope
                if event.get('timbre') == 'mouse':
                    # Defined mechanical attack, resonant body and release tick.
                    attack = math.exp(-t * 180)
                    body = .65 * math.sin(2 * math.pi * 1900 * t) + .35 * high
                    release_t = t - .024
                    release = (.32 * math.sin(2 * math.pi * 2600 * release_t) * math.exp(-release_t * 300)) if release_t >= 0 else 0
                    signal = max(-1, min(1, 1.6 * body * attack + release))
            else:
                envelope = math.sin(math.pi * i / length) ** 2
                signal = (.8 * high + .2 * noise) * envelope
            samples[pos] = max(-32767, min(32767, samples[pos] + round(32767 * gain * signal)))
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(samples.tobytes())


def transcribe(source, output, model_name):
    import torch
    import whisper
    torch.set_num_threads(4)
    model = whisper.load_model(model_name, device='cpu')
    result = model.transcribe(str(source), language='es', word_timestamps=True, fp16=False,
                              initial_prompt="José Moreno, Proyecto del Día.")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(result['text'])


def render(edit_file, output):
    edit = json.loads(edit_file.read_text())
    source = (edit_file.parent / edit['source']).resolve()
    transcript = json.loads((edit_file.parent / edit['transcript']).read_text())
    style_file = (edit_file.parent / edit['style']).resolve()
    style = json.loads(style_file.read_text())
    font = (style_file.parent / style['font_file']).resolve()
    if not font.is_file():
        raise ValueError('Falta la fuente de marca')
    meta = probe(source)
    duration = float(meta['format']['duration'])
    if not any(s['codec_type'] == 'audio' for s in meta['streams']):
        raise ValueError('El original no tiene audio')
    clips = edit['clips']
    validate_edit(clips, duration)
    words = [word for segment in transcript['segments'] for word in segment.get('words', [])]
    if not words and edit.get('mode') != 'montage':
        raise ValueError('La transcripción no tiene tiempos por palabra')
    mapped = cut_words(words, clips)
    captions = edit.get('captions') or group_captions(mapped, style['max_words'], style['max_chars'])
    total = sum(c['out'] - c['in'] for c in clips)
    for c in captions:
        if not 0 <= c['start'] < c['end'] <= total + .01:
            raise ValueError('Subtítulo fuera de la edición')
    for event in edit.get('effects', []):
        validate_event(event, total)
        visual_filter(event)
    for event in edit.get('sounds', []):
        if event.get('preset'):
            validate_event(event, total)
            if event['preset'] not in SOUNDS:
                raise ValueError('Se esperaba un preset de sonido')
        if not 0 <= event['time'] < total or not -60 <= event.get('gain_db', -29) <= -12:
            raise ValueError('Sonido fuera del rango permitido')
    if output.exists():
        raise ValueError('El archivo ya existe; usa un nombre de revisión nuevo')
    output.parent.mkdir(parents=True, exist_ok=True)
    required_free = max(256 * 1024 ** 2, int((total + 4) * 6 * 1024 ** 2))
    if shutil.disk_usage(output.parent).free < required_free:
        raise ValueError(f'Espacio insuficiente: se requieren {required_free // 1024**2} MB libres para esta duración')
    work = output.parent / (output.stem + '-render')
    work.mkdir(exist_ok=True)
    fonts = work / 'fonts'
    fonts.mkdir(exist_ok=True)
    shutil.copy2(font, fonts / 'brand.ttf')
    write_ass(captions, style, work / 'captions.ass', font)
    synth_sounds(work / 'sounds.wav', total, edit.get('sounds', []))
    args = [FFMPEG, '-hide_banner', '-y', '-threads', '2', '-filter_complex_threads', '2', '-i', str(source), '-i', str(work / 'sounds.wav')]
    brolls = edit.get('broll', [])
    for layer in brolls:
        file = (edit_file.parent / layer['source']).resolve()
        validate_broll(layer, float(probe(file)['format']['duration']), total)
        args += ['-threads', '2', '-i', str(file)]
    outro = edit.get('outro')
    outro_index = 2 + len(brolls)
    if outro:
        outro_file = (edit_file.parent / outro['source']).resolve()
        outro_meta = probe(outro_file)
        validate_edit([outro], float(outro_meta['format']['duration']))
        args += ['-threads', '2', '-i', str(outro_file)]
    music = edit.get('music')
    music_index = outro_index + (1 if outro else 0)
    if music:
        music_file = (edit_file.parent / music['source']).resolve()
        if float(probe(music_file)['format']['duration']) < total - .01:
            raise ValueError('La música es más corta que la voz')
        args += ['-i', str(music_file)]
    filters = []
    for i, clip in enumerate(clips):
        a, b, zoom = clip['in'], clip['out'], clip.get('zoom', 1)
        width = round(1080 * zoom / 2) * 2
        height = round(1920 * zoom / 2) * 2
        filters += [f'[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale={width}:{height}:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v{i}]',
                    f'[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000[a{i}]']
    inputs = ''.join(f'[v{i}][a{i}]' for i in range(len(clips)))
    filters.append(f'{inputs}concat=n={len(clips)}:v=1:a=1[base][voice]')
    picture = 'base'
    for i, layer in enumerate(brolls):
        a, b, at = layer['in'], layer['out'], layer['at']
        motion = zoom_filter(layer)
        dissolve = layer_fade_filter(layer)
        filters.append(f'[{i+2}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,{motion},{dissolve},setpts=PTS-STARTPTS+{at}/TB,setsar=1[br{i}]')
        filters.append(f'[{picture}][br{i}]overlay=0:0:eof_action={layer.get("eof_action", "pass")}:enable=\'gte(t,{at})*lt(t,{at+b-a})\'[picture{i}]')
        picture = f'picture{i}'
    for i, transition in enumerate(edit.get('transitions', [])):
        at, length = transition['time'], transition.get('duration', .2)
        if not 0 <= at < total or not .06 <= length <= .35 or at + length > total:
            raise ValueError('Transición fuera de la edición')
        end = at + length
        # Brief luminous blur observed in the supplied reel, before captions.
        filters.append(f"[{picture}]gblur=sigma=12:enable='between(t,{at},{end})',eq=brightness='0.24*sin(PI*(t-{at})/{length})':eval=frame:enable='between(t,{at},{end})'[transition{i}]")
        picture = f'transition{i}'
    for i, event in enumerate(edit.get('effects', [])):
        filters.append(f'[{picture}]{visual_filter(event)}[effect{i}]')
        picture = f'effect{i}'
    for i, marker in enumerate(edit.get('list_markers', [])):
        number, start, end = marker['number'], marker['start'], marker['end']
        if number not in (1, 2, 3) or not 0 <= start < end <= total:
            raise ValueError('Marcador de lista inválido')
        enable = f'gte(t,{start})*lt(t,{end})'
        filters.append(f"[{picture}]drawbox=x=70:y=1080:w=124:h=124:color=0xcc008f:t=fill:enable='{enable}',drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial Bold.ttf':text='{number}':fontsize=85:fontcolor=white:x=108:y=1090:enable='{enable}'[marker{i}]")
        picture = f'marker{i}'
    # Relative paths keep spaces and user-controlled paths out of filter syntax.
    filters.append(f'[{picture}]ass=captions.ass:fontsdir=fonts,format=yuv420p[captioned]')
    voice_filter = edit.get('voice_filter', 'highpass=f=75,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000')
    filters.append(f'[voice]{voice_filter}[norm]')
    if music:
        filters.append(f'[{music_index}:a]atrim=duration={total},asetpts=PTS-STARTPTS,aresample=48000[musicbed]')
        filters.append('[norm][1:a][musicbed]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89:level=false[mixed]')
    else:
        filters.append('[norm][1:a]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89:level=false[mixed]')
    if outro:
        a, b = outro['in'], outro['out']
        tail = b - a
        filters.append(f'[{outro_index}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,format=yuv420p[tailv]')
        if any(s['codec_type'] == 'audio' for s in outro_meta['streams']):
            filters.append(f'[{outro_index}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,volume={outro.get("gain", 0.35)}[taila]')
        else:
            filters.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={tail}[taila]')
        filters.append('[captioned][mixed][tailv][taila]concat=n=2:v=1:a=1[v][a]')
        total += tail
    else:
        filters.append('[captioned]null[v]')
        filters.append('[mixed]anull[a]')
    (work / 'filter.txt').write_text(';\n'.join(filters))
    temporary = work / 'output.mp4'
    args += ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]', '-t', str(total),
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-threads', '4', '-c:a', 'aac', '-b:a', '192k',
             '-movflags', '+faststart', '-map_metadata', '-1', str(temporary)]
    with (work / 'ffmpeg.log').open('w') as log:
        run(args, cwd=work, stdout=log, stderr=log)
    report = probe(temporary)
    actual = float(report['format']['duration'])
    if abs(actual - total) > .15:
        raise ValueError('La duración renderizada no coincide')
    run([FFMPEG, '-v', 'error', '-i', str(temporary), '-f', 'null', '-'], stdout=subprocess.DEVNULL)
    temporary.rename(output)
    (output.with_suffix('.json')).write_text(json.dumps({
        'status': 'local_draft', 'edit': edit, 'style': style, 'captions': captions,
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'verification': {'full_decode': True, 'duration': actual, 'expected_duration': total},
        'output': report,
    }, ensure_ascii=False, indent=2))
    from review_loop import build
    build(output)
    print(f'Borrador verificado: {output} ({actual:.2f}s)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    tr = commands.add_parser('transcribe')
    tr.add_argument('source', type=Path)
    tr.add_argument('output', type=Path)
    tr.add_argument('--model', default='base')
    rd = commands.add_parser('render')
    rd.add_argument('edit', type=Path)
    rd.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.command == 'transcribe':
        transcribe(args.source.resolve(), args.output.resolve(), args.model)
    else:
        render(args.edit.resolve(), args.output.resolve())


if __name__ == '__main__':
    main()
