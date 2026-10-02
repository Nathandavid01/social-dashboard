#!/usr/bin/env python3
"""Materialize an authenticated Drive reference without retaining its signed URL."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

root = Path(__file__).resolve().parents[1]
file_id, filename, expected_str, download_url = sys.argv[1:5]
expected = int(expected_str)
logical_target = root / 'media/yabuuchi/source' / filename
storage_root = Path('/Volumes/Extreme SSD/Nate Media/video-pipeline/media/yabuuchi/source')
storage_root.mkdir(parents=True, exist_ok=True)
target = logical_target.resolve() if logical_target.exists() else storage_root / filename
part = target.with_suffix(target.suffix + '.part')
record_path = root / 'runs/yabuuchi-library-download-status' / (file_id + '.json')
record_path.parent.mkdir(parents=True, exist_ok=True)
record = {'id': file_id, 'name': filename, 'expected_size': expected, 'local_path': str(logical_target), 'storage_path': str(target)}
try:
    existing = target.exists() and target.stat().st_size == expected
    if not existing:
        if target.exists():
            raise RuntimeError('Existing source has a different size; preserving it')
        request = urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=90) as response, part.open('wb') as output:
            while True:
                block = response.read(2 * 1024 * 1024)
                if not block:
                    break
                output.write(block)
        if part.stat().st_size != expected:
            raise RuntimeError('Downloaded size does not match Drive metadata')
        part.rename(target)
    if not logical_target.exists():
        logical_target.symlink_to(target)
    digest = hashlib.sha256()
    with target.open('rb') as source:
        for block in iter(lambda: source.read(2 * 1024 * 1024), b''):
            digest.update(block)
    probe = subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(target)], capture_output=True, text=True)
    metadata = json.loads(probe.stdout) if probe.returncode == 0 else {}
    video = next((s for s in metadata.get('streams', []) if s.get('codec_type') == 'video'), {})
    record.update({'status': 'present_size_verified' if existing else 'downloaded_size_verified', 'size': target.stat().st_size, 'sha256': digest.hexdigest(), 'duration': float(metadata.get('format', {}).get('duration', 0)), 'width': video.get('width'), 'height': video.get('height'), 'codec': video.get('codec_name'), 'frame_rate': video.get('r_frame_rate'), 'probe_ok': probe.returncode == 0, 'probe_error': probe.stderr.strip() if probe.returncode else None, 'authentication': 'Google Drive connector authenticated raw fetch; ephemeral download reference not retained'})
except Exception as error:
    record.update({'status': 'failed', 'error_type': type(error).__name__, 'error': 'Download or validation failed; signed URL omitted'})
record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(record, ensure_ascii=False))
sys.exit(0 if record['status'] != 'failed' else 1)
