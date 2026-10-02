#!/usr/bin/env python3
"""Grab contact sheets from the last Metricool videos of Monday clients."""
import json
import argparse
import os
import re
import subprocess
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'runs/metricool-tomorrow/report.json'
OUT = ROOT / 'runs/metricool-tomorrow/style'
FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
FFPROBE = '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
CDN = re.compile(r'https://static\.metricool\.com/[^?\s]+\.(mp4|mov)', re.I)


def slug(name):
    n = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    n = re.sub(r'[^a-zA-Z0-9]+', '-', n).strip('-').lower()
    return n or 'client'


def probe(url):
    raw = subprocess.check_output(
        [FFPROBE, '-v', 'error', '-show_entries', 'format=duration,size',
         '-show_entries', 'stream=width,height,codec_type', '-of', 'json', url],
        timeout=40,
    )
    data = json.loads(raw)
    video = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'), {})
    return {
        'duration': float(data.get('format', {}).get('duration') or 0),
        'bytes': int(data.get('format', {}).get('size') or 0),
        'width': video.get('width'),
        'height': video.get('height'),
    }


def grab(url, t, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{t:.2f}',
         '-i', url, '-frames:v', '1', '-vf', 'scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2',
         '-update', '1', str(dest)],
        check=True, timeout=50,
    )


def unique_videos(posts, limit=3):
    seen, urls = [], []
    for post in posts:
        for item in post.get('media') or []:
            if not CDN.search(item or ''):
                continue
            url = item.split('?')[0]
            if url in seen:
                continue
            seen.append(url)
            urls.append((url, post))
            if len(urls) >= limit:
                return urls
    return urls


def caption_stats(posts):
    texts = [(p.get('text') or '').strip() for p in posts if (p.get('text') or '').strip()]
    if not texts:
        return {}
    emojis = sum(1 for t in texts if re.search(r'[\U0001F300-\U0001FAFF]', t))
    hashes = sum(1 for t in texts if '#' in t)
    upper = sum(1 for t in texts if sum(c.isupper() for c in t) > sum(c.islower() for c in t))
    return {
        'samples': len(texts),
        'avg_chars': round(sum(len(t) for t in texts) / len(texts)),
        'emoji_rate': round(emojis / len(texts), 2),
        'hashtag_rate': round(hashes / len(texts), 2),
        'mostly_uppercase': round(upper / len(texts), 2),
        'examples': [t[:180] for t in texts[:3]],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, default=REPORT)
    parser.add_argument('--out', type=Path, default=OUT)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    catalog = []
    for client in report['clients']:
        posts = client.get('last10') or []
        videos = unique_videos(posts, 3)
        if not videos:
            continue
        name = client['name']
        folder = out / slug(name)
        folder.mkdir(parents=True, exist_ok=True)
        clips = []
        frames = []
        for i, (url, post) in enumerate(videos, 1):
            try:
                meta = probe(url)
            except Exception as exc:
                print('PROBE FAIL', name, exc)
                continue
            times = [0.4]
            dur = meta['duration']
            if dur > 2:
                times = [max(0.3, dur * 0.08), dur * 0.35, dur * 0.65, max(0.4, dur - 0.8)]
            shots = []
            for j, t in enumerate(times, 1):
                dest = folder / f'v{i}-{j}.jpg'
                try:
                    grab(url, t, dest)
                    shots.append(os.path.relpath(dest, ROOT))
                    frames.append(dest)
                except Exception as exc:
                    print('FRAME FAIL', name, i, j, exc)
            clips.append({
                'url': url,
                'date': post.get('date'),
                'networks': post.get('networks'),
                'text': (post.get('text') or '')[:240],
                **meta,
                'frames': shots,
            })
            print(name, i, f"{meta['width']}x{meta['height']}", f"{meta['duration']:.1f}s")
        if frames:
            sheet = folder / 'contact.jpg'
            n = len(frames)
            cols = min(4, n)
            inputs = []
            for f in frames:
                inputs += ['-i', str(f)]
            layout = '|'.join(f'{(i % cols) * 270}_{(i // cols) * 480}' for i in range(n))
            filt = f"{''.join(f'[{i}:v]' for i in range(n))}xstack=inputs={n}:layout={layout}:fill=black[v]"
            try:
                subprocess.run(
                    [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *inputs,
                     '-filter_complex', filt, '-map', '[v]', str(sheet)],
                    check=True, timeout=30,
                )
            except Exception as exc:
                print('SHEET FAIL', name, exc)
                sheet = None
        else:
            sheet = None
        entry = {
            'name': name,
            'id': client['id'],
            'slug': slug(name),
            'contact': None if sheet is None else os.path.relpath(sheet, ROOT),
            'captions': caption_stats(posts),
            'clips': clips,
        }
        (folder / 'meta.json').write_text(json.dumps(entry, ensure_ascii=False, indent=2))
        catalog.append(entry)
    (out / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    print('CLIENTS', len(catalog))


if __name__ == '__main__':
    main()
