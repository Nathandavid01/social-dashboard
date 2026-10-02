"""Build cached review media without changing original Yabuuchi footage."""
import concurrent.futures
import hashlib
import io
import json
import os
import subprocess
import time
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'runs/yabuuchi-library'
FF = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'

def canonical_files():
    drive = json.loads((ROOT / 'runs/yabuuchi-library-drive-inventory.json').read_text())
    by_id = {x['id']: x for x in drive['files']}
    return [by_id[i] for i in drive['canonical_source_ids']]

def prepare(f):
    src = ROOT / 'media/yabuuchi/source' / f['name']
    cache = OUT / 'metadata' / (src.stem + '.json')
    if cache.exists():
        return json.loads(cache.read_text())
    if not src.exists() or src.stat().st_size != int(f['size']):
        return None
    base = {'filename': src.name, 'source': str(src.relative_to(ROOT)), 'size': src.stat().st_size,
            'sha256': hashlib.sha256(src.read_bytes()).hexdigest(), 'drive_id': f['id'], 'drive_url': f['url'],
            'folder_path': f['folder_path'], 'batch': '9 Sep 2026' if '20260909' in src.name else '14 Sep 2026'}
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(src)], capture_output=True, text=True)
    if probe.returncode:
        base.update(status='unavailable', error='El original no se puede abrir como video; revisar o volver a cargar en Drive.')
        cache.write_text(json.dumps(base, ensure_ascii=False, indent=2))
        print('NO ABRE', src.name, flush=True)
        return base
    meta = json.loads(probe.stdout)
    video = next((s for s in meta['streams'] if s['codec_type'] == 'video'), None)
    if not video or float(meta['format'].get('duration', 0)) <= 0:
        base.update(status='unavailable', error='El archivo está vacío: no contiene una pista de video reproducible.')
        cache.write_text(json.dumps(base, ensure_ascii=False, indent=2)+'\n')
        print('SIN VIDEO', src.name, flush=True)
        return base
    duration = float(meta['format']['duration'])
    base.update(status='available', duration=duration, width=video['width'], height=video['height'],
                codec=video['codec_name'], frame_rate=video.get('avg_frame_rate'),
                has_audio=any(s['codec_type'] == 'audio' for s in meta['streams']))
    original = OUT / 'originals' / src.name
    if not original.exists():
        original.symlink_to(src.resolve())
    preview = OUT / 'previews' / (src.stem + '.mp4')
    code = src.stem.split('_')[-2]
    existing = ROOT / 'runs/yabuuchi-four-qa/raw-proxies' / (code + '.mp4')
    if preview.exists() and not cache.exists():
        check = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(preview)], capture_output=True, text=True)
        if check.returncode or abs(float(check.stdout or 0) - duration) > .25:
            preview.unlink()  # Incomplete generated preview, never original footage.
    if not preview.exists():
        if '20260914' in src.name and existing.exists():
            os.link(existing, preview)
        else:
            temporary = preview.with_suffix('.part.mp4')
            subprocess.run([FF, '-v', 'error', '-y', '-i', str(src), '-vf', "scale=540:960:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-threads', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(temporary)], check=True)
            temporary.replace(preview)
    stamps = [min(duration-.05, max(.05, t)) for t in [.2, duration*.18, duration*.38, duration*.58, duration*.78, duration-.2]]
    board = Image.new('RGB', (1080, 348), '#f7f5ef')
    draw = ImageDraw.Draw(board)
    for idx, stamp in enumerate(stamps):
        raw = subprocess.check_output([FF, '-v', 'error', '-ss', str(stamp), '-i', str(preview), '-vf', 'scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'])
        im = Image.open(io.BytesIO(raw))
        board.paste(im, (180*idx, 28))
        draw.text((180*idx+5, 8), f'{code} / {stamp:.2f}s', fill='#142d29')
    contact = OUT / 'contact' / (src.stem + '.jpg')
    board.save(contact, quality=88)
    poster = OUT / 'posters' / (src.stem + '.jpg')
    if not poster.exists():
        subprocess.run([FF, '-v', 'error', '-n', '-ss', str(min(duration*.35, 2)), '-i', str(preview), '-frames:v', '1', '-q:v', '3', str(poster)], check=True)
    base.update(preview_url='previews/'+preview.name, original_url='originals/'+original.name,
                poster_url='posters/'+poster.name, contact_url='contact/'+contact.name,
                sampled_times=stamps)
    cache.write_text(json.dumps(base, ensure_ascii=False, indent=2)+'\n')
    print('LISTO', src.name, f'{duration:.2f}s', flush=True)
    return base

def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--watch', action='store_true');args=p.parse_args()
    for name in ['metadata','originals','previews','posters','contact']:
        (OUT/name).mkdir(parents=True, exist_ok=True)
    files=canonical_files();deadline=time.monotonic()+1200
    while True:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results=list(pool.map(prepare, files))
        complete=sum(x is not None for x in results)
        print(f'Preparados {complete}/{len(files)} originales únicos',flush=True)
        if complete==len(files) or not args.watch or time.monotonic()>deadline:
            break
        time.sleep(8)

if __name__=='__main__': main()
