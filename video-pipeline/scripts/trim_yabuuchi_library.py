"""Export reviewed, silent B-roll ranges and source-level clean compilations.

Originals are immutable. Each content-addressed export retains source timecodes.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
import re
import subprocess
import time
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'runs/yabuuchi-library'
SSD = Path('/Volumes/Extreme SSD/Nate Media/video-pipeline/media/yabuuchi/broll-clean')
FF = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
FPS = 30000 / 1001


def load(path):
    return json.loads(path.read_text())


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def slug(value):
    value = ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c))
    return re.sub('[^a-z0-9]+', '-', value.lower()).strip('-')[:52]


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))


def verified(path, expected_frames):
    meta = probe(path)
    streams = meta['streams']
    videos = [s for s in streams if s['codec_type'] == 'video']
    assert len(videos) == 1 and not any(s['codec_type'] == 'audio' for s in streams), path
    v = videos[0]
    assert int(v['nb_frames']) == expected_frames, (path, v.get('nb_frames'), expected_frames)
    assert abs(float(meta['format']['duration']) - expected_frames / FPS) < .04, path
    return meta


def prepare_item(item, review, version):
    filename = item['filename']; code = item['id'].split('_')[-2]
    segments = review['segments']
    if not segments:
        return {'filename': filename, 'status': 'excluded', 'review': review,
                'reason': 'La revisión no encontró un tramo limpio para B-roll.'}
    source = ROOT / item['source']
    assert sha(source) == item['sha256'], 'Original changed: ' + filename
    recipe = {'source_sha256': item['sha256'], 'segments': segments,
              'format': 'h264-1080x1920-crf18-30000/1001-silent-v1'}
    digest = hashlib.sha256(json.dumps(recipe, sort_keys=True).encode()).hexdigest()[:10]
    storage = SSD / f'v{version}'
    entry_path = storage / 'metadata' / f'{code}-{digest}.json'
    if entry_path.exists():
        entry = load(entry_path)
        for segment in entry['segments']:
            assert (ROOT / segment['clip']['source']).is_file()
        assert (ROOT / entry['clean']['source']).is_file()
        return entry
    output_segments = []
    clip_paths = []
    total_frames = 0
    for number, s in enumerate(segments, 1):
        assert 0 <= s['in'] < s['out'] <= item['duration'] + .01, (filename, s)
        first_frame = math.ceil(s['in'] * FPS - 1e-7)
        end_frame = math.ceil(s['out'] * FPS - 1e-7)
        frames = end_frame - first_frame
        assert frames > 0
        start = first_frame / FPS
        name = f'Yabuuchi-{code}-{number:02d}-{slug(s["label"])}-{digest}.mp4'
        target = storage / 'tramos' / name
        if not target.exists():
            temp = target.with_suffix('.part.mp4')
            subprocess.run([FF, '-v', 'error', '-y', '-ss', f'{start:.9f}', '-i', str(source),
                            '-map', '0:v:0', '-an', '-sn', '-dn', '-frames:v', str(frames),
                            '-vf', 'scale=1080:1920:flags=lanczos,setsar=1', '-r', '30000/1001',
                            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '3',
                            '-pix_fmt', 'yuv420p', '-video_track_timescale', '30000',
                            '-movflags', '+faststart', str(temp)], check=True)
            verified(temp, frames)
            temp.replace(target)
        else:
            verified(target, frames)
        part = dict(s)
        part.update(source_in=s['in'], source_out=s['out'],
                    effective_source_in=round(start, 9), effective_source_out=round(end_frame/FPS, 9),
                    clean_in=round(total_frames/FPS, 9), clean_out=round((total_frames+frames)/FPS, 9))
        part['clip'] = {'source': f'media/yabuuchi/broll-clean/v{version}/tramos/{name}',
                        'filename': name, 'duration': round(frames/FPS, 9), 'frames': frames,
                        'download_url': f'clean/v{version}/tramos/{name}', 'sha256': sha(target),
                        'audio': 'none', 'width': 1080, 'height': 1920}
        output_segments.append(part); clip_paths.append(target); total_frames += frames
    clean_name = f'Yabuuchi-{code}-Broll-{digest}.mp4'
    clean_path = storage / 'completos' / clean_name
    if not clean_path.exists():
        playlist = storage / 'metadata' / f'{code}-{digest}-concat.txt'
        playlist.write_text(''.join("file '" + str(p).replace("'", "'\\''") + "'\n" for p in clip_paths))
        temp = clean_path.with_suffix('.part.mp4')
        subprocess.run([FF, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(playlist),
                        '-map', '0:v:0', '-an', '-c:v', 'copy', '-video_track_timescale', '30000',
                        '-movflags', '+faststart', str(temp)], check=True)
        verified(temp, total_frames); temp.replace(clean_path)
    else:
        verified(clean_path, total_frames)
    preview = LIB / 'clean-previews' / f'v{version}' / clean_name
    if not preview.exists():
        temp = preview.with_suffix('.part.mp4')
        subprocess.run([FF, '-v', 'error', '-y', '-i', str(clean_path), '-vf', 'scale=540:960',
                        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-threads', '2',
                        '-movflags', '+faststart', str(temp)], check=True)
        verified(temp, total_frames); temp.replace(preview)
    entry = {'filename': filename, 'status': 'ready', 'recipe': recipe, 'review': review,
             'original_duration': item['duration'], 'original_source': item['source'],
             'original_sha256': item['sha256'], 'segments': output_segments,
             'clean': {'source': f'media/yabuuchi/broll-clean/v{version}/completos/{clean_name}',
                       'filename': clean_name, 'duration': round(total_frames/FPS, 9),
                       'frames': total_frames, 'download_url': f'clean/v{version}/completos/{clean_name}',
                       'preview_url': f'clean-previews/v{version}/{clean_name}', 'sha256': sha(clean_path),
                       'audio': 'none', 'width': 1080, 'height': 1920,
                       'removed_seconds': round(item['duration']-total_frames/FPS, 3)}}
    entry_path.write_text(json.dumps(entry, ensure_ascii=False, indent=2)+'\n')
    print('RECORTADO', code, len(segments), 'tramos', f'{total_frames/FPS:.2f}s', flush=True)
    return entry


def main():
    p=argparse.ArgumentParser();p.add_argument('--version',type=int,default=1);p.add_argument('--watch',action='store_true');args=p.parse_args()
    assert Path('/Volumes/Extreme SSD').is_dir(), 'Conectar Extreme SSD.'
    version=args.version;storage=SSD/f'v{version}'
    for folder in ['tramos','completos','metadata']:(storage/folder).mkdir(parents=True,exist_ok=True)
    local=ROOT/'media/yabuuchi/broll-clean'/f'v{version}';local.parent.mkdir(parents=True,exist_ok=True)
    if not local.exists():local.symlink_to(storage,target_is_directory=True)
    public=LIB/'clean'/f'v{version}';public.parent.mkdir(parents=True,exist_ok=True)
    if not public.exists():public.symlink_to(storage,target_is_directory=True)
    (LIB/'clean-previews'/f'v{version}').mkdir(parents=True,exist_ok=True)
    index=load(ROOT/'media/yabuuchi/broll-index.json')
    source_items={i['filename']:i for i in index['items'] if i['kind'] in ('broll','mixed')}
    path=ROOT/f'runs/yabuuchi-library-clean-manifest-v{version}.json'
    manifest=load(path) if path.exists() else {'version':version,'status':'rendering','items':{}}
    if manifest['status'] == 'verified':
        print('Esta versión ya está verificada. Usar una versión nueva para incorporar cambios.', flush=True)
        return
    deadline=time.monotonic()+1800
    while True:
        reviews={}
        for file in sorted((ROOT/'runs').glob('yabuuchi-library-cut-review-*.json')):
            try:chunk=load(file)
            except json.JSONDecodeError:continue
            assert not reviews.keys() & chunk.keys(), 'Overlapping review ownership'
            reviews.update(chunk)
        todo=[(source_items[name],review) for name,review in reviews.items() if name in source_items and name not in manifest['items']]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(prepare_item,item,review,version) for item,review in todo]
            for future in concurrent.futures.as_completed(futures):
                entry=future.result();manifest['items'][entry['filename']]=entry
                path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        done=len(manifest['items']);print(f'Procesados {done}/{len(source_items)} originales con apoyo',flush=True)
        if done==len(source_items):break
        if not args.watch or time.monotonic()>deadline:return
        time.sleep(5)
    entries=[x for x in manifest['items'].values() if x['status']=='ready']
    manifest['status']='rendered_pending_verification'
    manifest['summary']={'source_count':len(entries),'segment_count':sum(len(x['segments']) for x in entries),
                         'excluded_source_count':len(source_items)-len(entries),
                         'duration_seconds':round(sum(x['clean']['duration'] for x in entries),3),
                         'removed_seconds':round(sum(x['clean']['removed_seconds'] for x in entries),3),
                         'format':'1080 × 1920, H.264, sin audio',
                         'originals_preserved':True}
    zipname=f'Yabuuchi-Broll-Recortados-v{version}.zip'
    zippath=storage/zipname
    with zipfile.ZipFile(zippath.with_suffix('.part.zip'),'w',compression=zipfile.ZIP_STORED) as z:
        for entry in entries:
            for segment in entry['segments']:
                clip=segment['clip'];z.write(ROOT/clip['source'],'Tramos/'+clip['filename'])
        z.writestr('LEEME.txt','YABUUCHI SUSHI · B-ROLL RECORTADO\n\nSólo tramos seleccionados; 1080 × 1920 y sin audio.\nOriginales conservados. Mantener la relación con su familia de escena al evitar repeticiones.\nConsultar catalogo-recortes.json para rangos originales y notas.\n')
        z.writestr('catalogo-recortes.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    zippath.with_suffix('.part.zip').replace(zippath)
    manifest['summary']['package_url']=f'clean/v{version}/{zipname}'
    manifest['summary']['package_size']=zippath.stat().st_size
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(manifest['summary'],ensure_ascii=False,indent=2),flush=True)


if __name__=='__main__':main()
