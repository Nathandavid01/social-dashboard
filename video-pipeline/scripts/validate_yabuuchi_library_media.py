#!/usr/bin/env python3
"""Read-only independent validation of the generated Yabuuchi library media."""
import concurrent.futures
import datetime
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / 'runs/yabuuchi-library'
FFPROBE = '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'

def probe(path):
    result = subprocess.run([FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], capture_output=True, text=True, timeout=40)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    obj = json.loads(result.stdout)
    video = next((s for s in obj.get('streams', []) if s.get('codec_type') == 'video'), {})
    fps = video.get('avg_frame_rate', video.get('r_frame_rate', '0/1'))
    top, bottom = map(float, fps.split('/'))
    return {'duration': float(obj.get('format', {}).get('duration', 0)), 'video_duration': float(video.get('duration', 0)), 'fps': top / bottom if bottom else 0, 'width': video.get('width'), 'height': video.get('height'), 'codec': video.get('codec_name'), 'video_stream_present': bool(video), 'has_audio': any(s.get('codec_type') == 'audio' for s in obj.get('streams', []))}

def check(item):
    metadata_path, metadata = item
    result = {'filename': metadata['filename'], 'metadata_path': str(metadata_path), 'status': 'pass', 'errors': []}
    if '_0363_' in metadata['filename']:
        result.update({'status': 'excluded_empty_source', 'reason': 'Known empty 1241-byte source; never decoded', 'metadata_status': metadata.get('status')})
        return result
    paths = {'source': ROOT / metadata['source']}
    for kind in ['preview', 'original', 'poster', 'contact']:
        relative = metadata.get(kind + '_url')
        if not relative:
            result['errors'].append(kind + '_url_missing')
        else:
            paths[kind] = LIBRARY / relative
    result['paths'] = {k: {'path': str(p), 'exists': p.is_file(), 'size': p.stat().st_size if p.is_file() else None} for k, p in paths.items()}
    for kind, detail in result['paths'].items():
        if not detail['exists'] or not detail['size']:
            result['errors'].append(kind + '_file_missing_or_empty')
    if not result['errors']:
        try:
            original = probe(paths['original'])
            preview = probe(paths['preview'])
            result['original'] = original
            result['preview'] = preview
            result['duration_difference_seconds'] = abs(original['duration'] - preview['duration'])
            result['duration_tolerance_seconds'] = 0.15
            result['maximum_frame_period_seconds'] = max(1 / max(original['fps'], 1), 1 / max(preview['fps'], 1))
            result['fps_difference'] = abs(original['fps'] - preview['fps'])
            if not original['video_stream_present'] or not preview['video_stream_present']:
                result['errors'].append('video_stream_missing')
            if result['duration_difference_seconds'] > 0.15:
                result['errors'].append('duration_difference_exceeds_0.15_seconds')
            result['source_matches_original_link'] = paths['source'].samefile(paths['original'])
            if not result['source_matches_original_link']:
                result['errors'].append('original_does_not_refer_to_same_source_file')
            from PIL import Image
            for kind in ['poster', 'contact']:
                with Image.open(paths[kind]) as picture:
                    picture.verify()
                result[kind + '_image_decodable'] = True
            decode = subprocess.run([FFMPEG, '-v', 'error', '-xerror', '-threads', '1', '-i', str(paths['preview']), '-f', 'null', '-'], capture_output=True, text=True, timeout=120)
            result['preview_full_decode'] = {'exit_code': decode.returncode, 'stderr': decode.stderr.strip(), 'passed': decode.returncode == 0}
            if decode.returncode:
                result['errors'].append('preview_full_decode_failed')
        except Exception as error:
            result['errors'].append(type(error).__name__ + ': ' + str(error))
    if result['errors']:
        result['status'] = 'failed'
    return result

paths = sorted((LIBRARY / 'metadata').glob('*.json'))
metadata = [(p, json.loads(p.read_text())) for p in paths]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(check, metadata))
report = {'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'metadata_file_count': len(paths), 'expected_metadata_file_count': 98, 'expected_reproducible_clip_count': 97, 'passed': sum(r['status'] == 'pass' for r in results), 'failed': sum(r['status'] == 'failed' for r in results), 'excluded_empty': sum(r['status'] == 'excluded_empty_source' for r in results), 'scope': 'File existence, valid JPEGs, original/preview duration and frame rates, symlink target correctness, full video/audio decode of preview only. Empty 0363 source excluded and never decoded. No original files altered.', 'results': results, 'error_list': [{'filename': r['filename'], 'errors': r['errors']} for r in results if r['errors']]}
report['status'] = 'pass' if len(paths) == 98 and report['passed'] == 97 and report['failed'] == 0 and report['excluded_empty'] == 1 else 'failed'
report['scope'] = report['scope'].replace('symlink target correctness', 'source identity through hard links or symlinks')
report['maximum_duration_difference_seconds'] = max(r.get('duration_difference_seconds', 0) for r in results)
report['preview_full_decode_pass_count'] = sum(r.get('preview_full_decode', {}).get('passed', False) for r in results)
output = ROOT / 'runs/yabuuchi-library-qa/media-validation.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'results'}, ensure_ascii=False, indent=2))
