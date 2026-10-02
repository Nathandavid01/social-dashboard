#!/usr/bin/env python3
"""Local dialogue levelling and measured, two-pass audio mastering for reels."""
import argparse
import hashlib
import json
import math
import os
from file_publish import publish_file
from pathlib import Path
import re
import subprocess

import numpy as np

ROOT = Path(__file__).resolve().parent
FFMPEG = os.environ.get('FFMPEG', '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg')
FFPROBE = os.environ.get('FFPROBE', 'ffprobe')
RATE = 48000
PROFILE = ROOT / 'styles/audio-master.json'
VERSION = 1
STEREO = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, **kwargs)
    if result.returncode:
        error = result.stderr
        if isinstance(error, bytes):
            error = error.decode(errors='replace')
        raise RuntimeError(f'Audio: falló {Path(str(args[0])).name}: {error[-3000:]}')
    return result


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def probe(path):
    return json.loads(run([FFPROBE, '-v', 'error', '-show_format', '-show_streams',
                           '-of', 'json', str(path)], text=True).stdout)


def settings(edit=None, **overrides):
    edit = edit or {}
    cfg = json.loads(PROFILE.read_text())
    cfg.update(mode='music' if edit.get('caption_mode') == 'editorial' else 'dialogue',
               voice_mode='preserve' if edit.get('voice_adjustment') else 'auto', speech_regions=None)
    allowed = set(cfg)
    custom = edit.get('audio_master', {})
    if not isinstance(custom, dict) or set(custom) - allowed or set(overrides) - allowed:
        raise ValueError('Parámetros de audio_master desconocidos; consulta AUDIO.md')
    cfg.update(custom)
    cfg.update({k: v for k, v in overrides.items() if v is not None})
    ranges = {
        'target_lufs': (-30, -14), 'true_peak_dbtp': (-9, -1), 'lra_lu': (1, 20),
        'loudness_tolerance_lu': (.1, 2), 'max_master_boost_db': (0, 18),
        'voice_target_rms_dbfs': (-32, -18), 'max_voice_boost_db': (0, 12),
        'max_voice_cut_db': (0, 24), 'voice_noise_floor_dbfs': (-60, -30),
        'voice_peak_dbfs': (-12, -3), 'ramp_seconds': (.01, .15),
        'music_below_voice_lu': (6, 24), 'outro_above_voice_lu': (-6, 3),
    }
    for key, (low, high) in ranges.items():
        value = cfg[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f'Audio: {key} debe estar entre {low} y {high}')
    if cfg['mode'] not in ('dialogue', 'music') or cfg['voice_mode'] not in ('auto', 'preserve'):
        raise ValueError('Audio: mode=dialogue|music, voice_mode=auto|preserve')
    return cfg


def parse_loudnorm(stderr):
    matches = re.findall(r'\{\s*"input_i"\s*:.*?\}', stderr, re.S)
    if not matches:
        raise ValueError('FFmpeg no devolvió medidas de sonoridad')
    raw = json.loads(matches[-1])
    out = {}
    for name in ('input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'):
        value = float(raw[name])
        out[name] = value if math.isfinite(value) else None
    out['normalization_type'] = raw.get('normalization_type')
    return out


def loudnorm_filter(cfg, measured=None, ceiling=None):
    ceiling = cfg['true_peak_dbtp'] if ceiling is None else ceiling
    s = f"loudnorm=I={cfg['target_lufs']}:TP={ceiling}:LRA={cfg['lra_lu']}"
    if measured:
        for target, source in [('measured_I', 'input_i'), ('measured_TP', 'input_tp'),
                               ('measured_LRA', 'input_lra'), ('measured_thresh', 'input_thresh'),
                               ('offset', 'target_offset')]:
            if measured[source] is None:
                raise ValueError('Audio silencioso o sonoridad no medible; no se normaliza')
            s += f':{target}={measured[source]}'
        s += ':linear=true'
    return s + ':print_format=json'


def measure(path, cfg=None, prefilter='anull', ceiling=None):
    cfg = cfg or settings()
    result = run([FFMPEG, '-hide_banner', '-nostdin', '-i', str(path), '-map', '0:a:0',
                  '-af', prefilter + ',' + STEREO + ',' + loudnorm_filter(cfg, ceiling=ceiling),
                  '-vn', '-f', 'null', '-'], text=True)
    return parse_loudnorm(result.stderr)


def decode(path, audio_filter='anull'):
    result = run([FFMPEG, '-v', 'error', '-nostdin', '-i', str(path), '-map', '0:a:0',
                  '-vn', '-af', audio_filter, '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'])
    samples = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2).copy()
    if not np.isfinite(samples).all():
        raise ValueError('Audio contiene muestras no finitas')
    return samples


def write_float(path, samples):
    run([FFMPEG, '-v', 'error', '-nostdin', '-y', '-f', 'f32le', '-ar', str(RATE),
         '-ac', '2', '-i', 'pipe:0', '-c:a', 'pcm_f32le', str(path)],
        input=np.asarray(samples, dtype='<f4').tobytes())


def active_rms(samples, floor=-42):
    """20 ms active windows, max channel energy: no phase cancellation or silence boost."""
    block = int(RATE * .02)
    if len(samples) < block:
        return None
    frames = samples[:len(samples) // block * block].reshape(-1, block, 2)
    energy = np.mean(frames.astype(np.float64) ** 2, axis=1).max(axis=1)
    gate = max(10 ** (floor / 10), float(np.percentile(energy, 90)) / 316.23)
    active = energy[energy > gate]
    return round(float(10 * np.log10(active.mean())), 3) if len(active) else None


def validate_regions(regions, duration):
    previous = 0
    out = []
    for region in regions:
        a, b = region['start'], region['end']
        if not all(isinstance(t, (int, float)) and not isinstance(t, bool) and math.isfinite(t) for t in (a, b)):
            raise ValueError('Intervenciones de audio: tiempos no finitos')
        if not 0 <= a < b <= duration + .001 or a < previous - .001:
            raise ValueError('Intervenciones de audio solapadas o fuera del montaje')
        if b - a < .1:
            raise ValueError('Intervención de audio demasiado corta (<100 ms)')
        out.append({**region, 'start': a, 'end': min(b, duration)})
        previous = b
    return out


def speech_regions(words, duration, explicit=None):
    if explicit is not None:
        return validate_regions(explicit, duration), 'explicit'
    regions, current = [], []
    for word in words:
        if word['end'] <= word['start']:
            continue
        if current:
            last = current[-1]
            punctuation = last['word'].strip().endswith(('.', '?', '!'))
            pause = word['start'] - last['end'] >= .25
            speaker = word.get('speaker') != last.get('speaker')
            long = last['end'] - current[0]['start'] >= 5
            if pause or speaker or long or (punctuation and last['end'] - current[0]['start'] >= .35):
                regions.append({'start': current[0]['start'], 'end': last['end']})
                current = []
        current.append(word)
    if current:
        regions.append({'start': current[0]['start'], 'end': current[-1]['end']})
    regions = [r for r in regions if r['end'] - r['start'] >= .1]
    return validate_regions(regions, duration), 'transcript_phrases_not_speaker_diarization'


def level_regions(samples, regions, cfg):
    """Sample-accurate gain ramps; never keep a stale frame gain over the last answer."""
    envelope = np.ones(len(samples), dtype=np.float64)
    records = []
    for i, r in enumerate(regions):
        a, b = round(r['start'] * RATE), min(len(samples), round(r['end'] * RATE))
        level = active_rms(samples[a:b], cfg['voice_noise_floor_dbfs'])
        gain = 0 if level is None else max(-cfg['max_voice_cut_db'], min(cfg['max_voice_boost_db'], cfg['voice_target_rms_dbfs'] - level))
        gain = round(gain, 3)
        factor = 10 ** (gain / 20)
        # Keep ramps outside speech, bounded at the midpoint of neighbouring gaps.
        left = regions[i - 1]['end'] if i else 0
        right = regions[i + 1]['start'] if i + 1 < len(regions) else len(samples) / RATE
        ra = min(round(cfg['ramp_seconds'] * RATE), max(0, round((r['start'] - left) * RATE / 2)))
        rb = min(round(cfg['ramp_seconds'] * RATE), max(0, round((right - r['end']) * RATE / 2)))
        envelope[a:b] = factor
        if ra:
            envelope[a-ra:a] = np.linspace(1, factor, ra, endpoint=False)
        if rb:
            envelope[b:b+rb] = np.linspace(factor, 1, rb, endpoint=False)
        records.append({**r, 'active_rms_before_dbfs': level, 'gain_db': gain,
                        'noise_or_silence_skipped': level is None})
    # A 10 ms smoothing kernel removes discontinuities at contiguous speech boundaries.
    n = int(RATE * .01) | 1
    kernel = np.ones(n) / n
    envelope = np.convolve(np.pad(envelope, (n//2, n//2), mode='edge'), kernel, mode='valid')
    return (samples * envelope[:, None]).astype(np.float32), records


def prepare_voice(edit_file, edit, words, work, cfg):
    source = (edit_file.parent / edit['source']).resolve()
    total = sum(c['out'] - c['in'] for c in edit['clips'])
    filters = []
    for i, c in enumerate(edit['clips']):
        a, b = c['in'], c['out']
        fade = c.get('audio_edge_fade', 0)
        if not 0 <= fade <= min(.03, (b-a)/2):
            raise ValueError('Fundido de audio fuera de rango')
        edge = f',afade=t=in:d={fade},afade=t=out:st={b-a-fade}:d={fade}' if fade else ''
        filters.append(f'[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample={RATE}{edge}[s{i}]')
    labels = ''.join(f'[s{i}]' for i in range(len(edit['clips'])))
    # Existing client-specific cleanup/automation is preserved, never silently removed.
    cleanup = edit.get('voice_filter', 'highpass=f=75' if cfg['mode'] == 'dialogue' else 'anull')
    filters.append(f'{labels}concat=n={len(edit["clips"])}:v=0:a=1,{cleanup},aresample={RATE},apad,atrim=duration={total}[a]')
    raw = work / 'audio-voice-input.wav'
    run([FFMPEG, '-v', 'error', '-nostdin', '-y', '-i', str(source), '-filter_complex',
         ';'.join(filters), '-map', '[a]', '-ac', '2', '-ar', str(RATE), '-c:a', 'pcm_f32le', str(raw)])
    samples = decode(raw)
    regions, provenance = speech_regions(words, total, cfg['speech_regions'])
    warnings = []
    auto = cfg['mode'] == 'dialogue' and cfg['voice_mode'] == 'auto'
    if auto and not regions:
        warnings.append('Sin intervenciones identificadas: no se aplica nivelación por frase.')
    if auto and regions:
        processed, records = level_regions(samples, regions, cfg)
    else:
        processed, records = samples, []
    if any(r['noise_or_silence_skipped'] for r in records):
        warnings.append('Se omitió ganancia en voz demasiado débil o silencio; revisar esos rangos.')
    if np.max(np.abs(samples), initial=0) >= .999:
        warnings.append('Picos cerca de saturación en entrada procesada; normalizar no repara distorsión grabada.')
    leveled = work / 'audio-voice-leveled.wav'
    write_float(leveled, processed)
    final = work / 'audio-voice.wav'
    peak = 10 ** (cfg['voice_peak_dbfs'] / 20)
    compressor = 'acompressor=threshold=0.12589254:ratio=2:attack=8:release=120:makeup=1:knee=2.828:link=maximum'
    processing = (compressor + f',alimiter=limit={peak}:attack=5:release=80:level=false:latency=true') if auto else 'anull'
    run([FFMPEG, '-v', 'error', '-nostdin', '-y', '-i', str(leveled), '-af',
         f'{processing},apad,atrim=duration={total}', '-ar', str(RATE), '-ac', '2', '-c:a', 'pcm_f32le', str(final)])
    after = decode(final)
    if abs(len(after) - round(total * RATE)) > 1:
        raise ValueError('El procesamiento de voz cambió su duración')
    for r in records:
        a, b = round(r['start'] * RATE), round(r['end'] * RATE)
        r['active_rms_after_dbfs'] = active_rms(after[a:b], cfg['voice_noise_floor_dbfs'])
    levels = [r['active_rms_after_dbfs'] for r in records if r['active_rms_after_dbfs'] is not None]
    spread = round(max(levels) - min(levels), 2) if levels else None
    if spread is not None and spread > 6:
        warnings.append('Diferencia de voz mayor de 6 dB tras ganancia limitada: requiere revisión de mezcla.')
    report = {'version': VERSION, 'settings': cfg, 'cleanup_filter': cleanup,
              'mode': 'automatic_phrase_levelling' if auto else 'preserve_voice_balance',
              'region_provenance': provenance, 'regions': records,
              'voice_spread_db': spread, 'warnings': warnings, 'duration': total,
              'measurement': measure(final, cfg), 'sha256': digest(final), 'critical_listening': 'pending'}
    save(work / 'audio-voice-report.json', report)
    return final, report


def supporting_gain(path, cfg, voice_report, kind, start=0, end=None, gain=1):
    """Lower an overpowering music bed/outro; never raise a quiet branded asset."""
    voice_level = voice_report['measurement']['input_i']
    if voice_level is None or cfg['mode'] == 'music':
        return 0, {'kind': kind, 'gain_db': 0, 'reason': 'No dialogue reference'}
    pre = f'atrim=start={start}' + (f':end={end}' if end is not None else '')
    pre += f',asetpts=PTS-STARTPTS,volume={gain}'
    observed = measure(path, cfg, prefilter=pre)
    target = voice_level - cfg['music_below_voice_lu'] if kind == 'music' else voice_level + cfg['outro_above_voice_lu']
    delta = min(0, target - observed['input_i']) if observed['input_i'] is not None else 0
    delta = round(delta, 3)
    return delta, {'kind': kind, 'before': observed, 'gain_db': delta, 'target_lufs': round(target, 2)}


def checks(measured, cfg):
    reasons = []
    if measured['input_i'] is None:
        reasons.append('Audio silencioso o demasiado corto para medir LUFS')
    elif abs(measured['input_i'] - cfg['target_lufs']) > cfg['loudness_tolerance_lu']:
        reasons.append('Sonoridad fuera del objetivo y tolerancia')
    if measured['input_tp'] is None or measured['input_tp'] > cfg['true_peak_dbtp'] + .05:
        reasons.append('Pico verdadero por encima del techo')
    return reasons


def normalize(source, output, cfg=None, work=None):
    """Two passes on lossless input, then measure the actual encoded delivery file."""
    cfg = cfg or settings()
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.exists() or source == output:
        raise ValueError('No se sobrescribe audio/video existente; usa una versión nueva')
    if output.suffix.lower() not in ('.mp4', '.m4a', '.wav'):
        raise ValueError('La salida debe ser .mp4, .m4a o .wav')
    output.parent.mkdir(parents=True, exist_ok=True)
    work = Path(work) if work else output.with_name(output.stem + '-audio-work')
    work.mkdir(parents=True, exist_ok=True)
    info = probe(source)
    if not any(s['codec_type'] == 'audio' for s in info['streams']):
        raise ValueError('El archivo no tiene pista de audio')
    before = measure(source, cfg)
    report = {'version': VERSION, 'source': str(source), 'source_sha256': digest(source),
              'settings': cfg, 'before': before, 'attempts': [],
              'critical_listening': 'pending', 'status': 'needs_correction'}
    if before['input_i'] is None or cfg['target_lufs'] - before['input_i'] > cfg['max_master_boost_db']:
        report['findings'] = ['Silencio o ganancia global excesiva; revisar fuente/mezcla antes de normalizar']
        save(work / 'audio-master-report.json', report)
        raise ValueError(report['findings'][0])
    has_video = any(s['codec_type'] == 'video' for s in info['streams'])
    ceiling = max(-9, cfg['true_peak_dbtp'] - .4)  # AAC can create new intersample peaks.
    filter_cfg = cfg  # objetivo del filtro; checks() siempre compara contra cfg['target_lufs']
    for attempt in range(2):
        measured = measure(source, filter_cfg, ceiling=ceiling)
        candidate = work / f'mastered-{attempt+1}{output.suffix}'
        args = [FFMPEG, '-hide_banner', '-nostdin', '-y', '-i', str(source)]
        if has_video and output.suffix.lower() == '.mp4':
            args += ['-map', '0:v:0', '-c:v', 'copy']
        # loudnorm cae a modo dinámico si el LRA supera lra_lu y entonces añade ~80–100 ms
        # de cola; atrim devuelve la duración exacta de la entrada (no rellena si es más corta).
        trim = f",atrim=duration={float(info['format']['duration'])}"
        args += ['-map', '0:a:0', '-af', STEREO + ',' + loudnorm_filter(filter_cfg, measured, ceiling) + ',aresample=48000' + trim, '-ar', '48000', '-ac', '2']
        if output.suffix.lower() == '.wav':
            args += ['-c:a', 'pcm_s24le']
        else:
            args += ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart']
        args += ['-map_metadata', '-1', str(candidate)]
        result = run(args, text=True)
        after = measure(candidate, cfg)
        failures = checks(after, cfg)
        duration_delta = abs(float(probe(candidate)['format']['duration']) - float(info['format']['duration']))
        if duration_delta > .06:
            failures.append('La duración cambió más de 60 ms')
        report['attempts'].append({'ceiling_dbtp': ceiling, 'filter_target_lufs': filter_cfg['target_lufs'],
                                   'after': after,
                                   'normalization_type': parse_loudnorm(result.stderr)['normalization_type'],
                                   'findings': failures, 'duration_delta': duration_delta})
        if not failures:
            run([FFMPEG, '-v', 'error', '-nostdin', '-i', str(candidate), '-f', 'null', '-'])
            report.update(status='pass', after=after, full_decode=True,
                          output=str(output), output_sha256=digest(candidate),
                          video_stream_copied=has_video and output.suffix.lower() == '.mp4')
            # Atomic, no-clobber publish on the same filesystem.
            publish_file(candidate, output)
            candidate.unlink()
            save(work / 'audio-master-report.json', report)
            return report
        if (failures == ['Sonoridad fuera del objetivo y tolerancia'] and filter_cfg is cfg
                and after['input_i'] is not None):
            # loudnorm dinámico (LRA > lra_lu) puede quedar corto de forma estable en clips breves
            # (Apiario countdown 2026-09-29: −21.05 con objetivo −20 desde −15.2 y desde −20.0).
            # Un reintento corrige solo el objetivo del filtro por el error medido (±3 LU).
            shift = max(-3.0, min(3.0, cfg['target_lufs'] - after['input_i']))
            filter_cfg = dict(cfg, target_lufs=round(cfg['target_lufs'] + shift, 2))
            continue
        if after['input_tp'] is None or after['input_tp'] <= cfg['true_peak_dbtp'] + .05:
            break
        ceiling -= max(.5, after['input_tp'] - cfg['true_peak_dbtp'] + .2)
        if ceiling < -9:
            break
    report['findings'] = report['attempts'][-1]['findings']
    save(work / 'audio-master-report.json', report)
    raise ValueError('Control de audio pendiente: ' + '; '.join(report['findings']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    analyze = commands.add_parser('analyze', help='Medir un reel sin modificarlo')
    analyze.add_argument('source', type=Path)
    analyze.add_argument('--report', type=Path)
    master = commands.add_parser('normalize', help='Normalizar una mezcla terminada sin recodificar imagen')
    master.add_argument('source', type=Path)
    master.add_argument('output', type=Path)
    master.add_argument('--target-lufs', type=float)
    master.add_argument('--true-peak-dbtp', type=float)
    prepare = commands.add_parser('prepare', help='Preparar voces de una receta sin renderizar imagen')
    prepare.add_argument('edit', type=Path)
    prepare.add_argument('work_dir', type=Path)
    args = parser.parse_args()
    if args.command == 'analyze':
        cfg = settings()
        m = measure(args.source, cfg)
        report = {'source': str(args.source.resolve()), 'sha256': digest(args.source),
                  'measurement': m, 'findings': checks(m, cfg), 'critical_listening': 'pending'}
        if args.report:
            if args.report.exists():
                raise ValueError('El informe ya existe; usa otro nombre')
            save(args.report, report)
    elif args.command == 'prepare':
        from pipeline import cut_words, validate_edit
        edit_file = args.edit.resolve()
        edit = json.loads(edit_file.read_text())
        validate_edit(edit['clips'], float(probe(edit_file.parent / edit['source'])['format']['duration']))
        transcript = json.loads((edit_file.parent / edit['transcript']).read_text()) if edit.get('transcript') else {'segments': []}
        words = cut_words([w for s in transcript['segments'] for w in s.get('words', [])], edit['clips'])
        args.work_dir.mkdir(parents=True, exist_ok=False)
        voice, report = prepare_voice(edit_file, edit, words, args.work_dir.resolve(), settings(edit))
        report['voice_file'] = str(voice)
    else:
        cfg = settings(target_lufs=args.target_lufs, true_peak_dbtp=args.true_peak_dbtp)
        report = normalize(args.source, args.output, cfg)
        report['scope'] = 'Final mix only; no isolated dialogue or speaker levelling from mixed audio'
        save(args.output.with_suffix('.audio.json'), report)
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
