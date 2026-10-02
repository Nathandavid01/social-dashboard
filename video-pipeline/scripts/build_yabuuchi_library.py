"""Assemble the visually annotated Yabuuchi library and current edit usage."""
import argparse
import csv
import io
import json
import shutil
import subprocess
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'runs/yabuuchi-library'
INDEX = ROOT / 'media/yabuuchi/broll-index.json'


def read(path):
    return json.loads(path.read_text())


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.lower()) if not unicodedata.combining(c))


def current_uses(clean_manifest=None):
    manifest = read(ROOT / 'runs/yabuuchi-selection-manifest.json')
    additional = ROOT / 'runs/yabuuchi-additional-current-reels.json'
    if additional.is_file():
        manifest['items'].extend(read(additional)['items'])
    derived = {}
    for entry in (clean_manifest or {}).get('items', {}).values():
        if entry['status'] != 'ready':
            continue
        derived[entry['clean']['filename']] = (entry['original_source'], entry['segments'])
        for segment in entry['segments']:
            derived[segment['clip']['filename']] = (entry['original_source'], [{**segment, 'clean_in': 0, 'clean_out': segment['clip']['duration']}])
    result = []
    for reel in manifest['items']:
        for kind, shots in [('overlay', reel.get('broll', [])), ('timeline', reel.get('timeline_broll', []))]:
            for shot in shots:
                use = {'title': reel['title'], 'reel': reel['title'], 'slug': reel['slug'],
                               'export': reel['file'], 'recipe': reel['recipe'],
                               'source': shot['source'], 'filename': Path(shot['source']).name,
                               'in': shot.get('in', shot.get('start')),
                               'out': shot.get('out', shot.get('end')),
                               'at': shot.get('at'), 'reason': shot.get('reason', shot.get('purpose', '')),
                               'placement': kind}
                if use['filename'] in derived:
                    original, mapping = derived[use['filename']]
                    for segment in mapping:
                        a = max(use['in'], segment['clean_in'])
                        b = min(use['out'], segment['clean_out'])
                        if b <= a:
                            continue
                        result.append({**use, 'derived_source': use['source'],
                                       'source': original, 'filename': Path(original).name,
                                       'in': round(segment['effective_source_in'] + a-segment['clean_in'], 6),
                                       'out': round(segment['effective_source_in'] + b-segment['clean_in'], 6)})
                else:
                    result.append(use)
    return manifest, result


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    drive = read(ROOT / 'runs/yabuuchi-library-drive-inventory.json')
    by_id = {x['id']: x for x in drive['files']}
    annotations = {}
    clean_manifest = {}
    clean_pointer = ROOT / 'runs/yabuuchi-library-clean-current.json'
    if clean_pointer.exists():
        clean_manifest = read(ROOT / read(clean_pointer)['manifest'])
        assert clean_manifest['status'] == 'verified', 'Los recortes deben estar verificados antes de mostrarlos.'
    for path in sorted((ROOT / 'runs').glob('yabuuchi-library-annotations-*.json')):
        chunk = read(path)
        assert not (annotations.keys() & chunk.keys()), 'Duplicate annotation ownership: ' + str(path)
        annotations.update(chunk)
    manifest, uses = current_uses(clean_manifest)
    items = []
    for file_id in drive['canonical_source_ids']:
        remote = by_id[file_id]
        filename = remote['name']
        stem = Path(filename).stem
        cache = OUT / 'metadata' / (stem + '.json')
        meta = read(cache) if cache.exists() else {}
        annotation = annotations.get(filename, {})
        item = {
            'id': stem, 'filename': filename, 'source': 'media/yabuuchi/source/' + filename,
            'title': filename, 'description': 'Pendiente de revisión visual.',
            'kind': 'pending', 'category': 'Por revisar', 'tags': [], 'segments': [],
            'scene_family': stem, 'location': 'Sede por confirmar',
            'batch': '9 Sep 2026' if '20260909' in filename else '14 Sep 2026',
            'date': '2026-09-09' if '20260909' in filename else '2026-09-14',
            'drive_id': file_id, 'drive_url': remote['url'],
            'review_status': 'pending',
        }
        item.update(meta)
        if meta.get('status') == 'available':
            item.update(annotation)
            item['category'] = {'Fachada Y Local': 'Local', 'Tomas Habladas': 'Presentación', 'Producto Terminado': 'Producto', 'Producto Y Presentación': 'Producto', 'Consumo Y Presentación': 'Experiencia'}.get(item['category'], item['category'])
            if item['category'] == 'Descartes' and not item['segments']:
                item['kind'] = 'discard'
            for segment in item['segments']:
                assert 0 <= segment['in'] < segment['out'] <= item['duration'] + .05, (filename, segment)
                segment['in'] = round(segment['in'], 3)
                segment['out'] = round(min(segment['out'], item['duration']), 3)
            if item['segments']:
                first = item['segments'][0]
                stamp = (first['in'] + first['out']) / 2
                poster = OUT / 'posters' / f'{stem}-broll-{round(stamp*1000)}.jpg'
                if not poster.exists():
                    subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '-v', 'error', '-n', '-ss', str(stamp), '-i', str(OUT / item['preview_url']), '-frames:v', '1', '-vf', 'scale=360:640:force_original_aspect_ratio=decrease', '-q:v', '3', str(poster)], check=True)
                item['poster_url'] = 'posters/' + poster.name
        elif meta.get('status') == 'unavailable':
            item.update(kind='unavailable', title='Archivo incompleto · ' + stem.split('_')[-2],
                        category='Archivo incompleto', description=meta['error'],
                        caution=f"El archivo de Drive pesa {meta['size']:,} bytes y no contiene un video reproducible. Se conserva en el inventario para solicitar una nueva copia.",
                        review_status='failed_media_probe')
        cut = clean_manifest.get('items', {}).get(filename)
        if cut:
            item['original_kind'] = item['kind']
            item['original_title'] = item['title']
            item['original_description'] = item['description']
            item['cut_review'] = cut['review']
            if cut['status'] == 'ready':
                assert cut['original_sha256'] == item['sha256'], 'La fuente del recorte cambió: ' + filename
                item['clean'] = cut['clean']
                item['segments'] = cut['segments']
                item['kind'] = 'broll'
                item['review_status'] = 'trimmed_boundary_review'
                titles = {
                    '0362': 'Caja coral: pose con el empaque',
                    '0370': 'Dumpling: bocado con palillos',
                    '0003': 'Palillos: abrir y tomar una pieza',
                    '0996': 'Fachada y logo de Yabuuchi',
                    '0020': 'Entrada y barra exterior',
                    '0327': 'Roll con cobertura: salsa y detalles',
                    '0983': 'Estación de ingredientes y tabla',
                    '0984': 'Sartén con carne en la hornilla',
                    '0350': 'Roll dorado en caja: acercamiento',
                    '0352': 'Roll dorado: detalle del producto',
                    '0364': 'Churrasco Roll: caja abierta y detalle',
                    '0365': 'Churrasco Roll: apertura de caja y producto',
                    '0367': 'Variedad de rolls en cajas abiertas',
                }
                item['title'] = titles.get(stem.split('_')[-2], item['title'])
                item['description'] = ' · '.join(s['label'] for s in item['segments']) + '. Sólo los tramos recortados, sin audio.'
                poster_dir = OUT / 'clean-posters' / f'v{clean_manifest["version"]}'
                poster_dir.mkdir(parents=True, exist_ok=True)
                poster = poster_dir / (Path(item['clean']['filename']).stem + '.jpg')
                if not poster.exists():
                    stamp = min(item['segments'][0]['clip']['duration'] / 2, 2)
                    subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '-v', 'error', '-n', '-ss', str(stamp), '-i', str(OUT / item['clean']['preview_url']), '-frames:v', '1', '-vf', 'scale=360:640', '-q:v', '3', str(poster)], check=True)
                item['poster_url'] = str(poster.relative_to(OUT))
            else:
                item['segments'] = []
                item['kind'] = 'discard'
                item['category'] = 'Descartes'
                item['caution'] = cut['reason'] + ' ' + item.get('caution', '')
        matching = [u for u in uses if u['filename'] == filename]
        item['use_ranges'] = matching
        item['uses'] = list({u['slug']: {'title': u['title'], 'slug': u['slug'], 'export': u['export']} for u in matching}.values())
        item['used_in_count'] = len(item['uses'])
        for segment in item['segments']:
            segment['uses'] = [u for u in matching if u['in'] < segment['out'] and u['out'] > segment['in']]
        items.append(item)
    family_uses = defaultdict(set)
    hash_groups = defaultdict(list)
    for item in items:
        family_uses[item['scene_family']].update(u['slug'] for u in item['uses'])
        if item.get('sha256'):
            hash_groups[item['sha256']].append(item['id'])
    for item in items:
        item['family_used_in_count'] = len(family_uses[item['scene_family']])
        item['duplicate_ids'] = [i for i in hash_groups.get(item.get('sha256'), []) if i != item['id']]
    items.sort(key=lambda x: (x['kind'] not in ('broll', 'mixed'), x['used_in_count'], x['family_used_in_count'], x['category'], x['filename']))
    counts = Counter(i['kind'] for i in items)
    summary = {
        'source_count': len(items), 'available_count': sum(i.get('status') == 'available' for i in items),
        'broll_count': sum(bool(i['segments']) and i['kind'] in ('broll', 'mixed') for i in items),
        'segment_count': sum(len(i['segments']) for i in items if i['kind'] in ('broll', 'mixed')), 'dialogue_count': counts['dialogue'],
        'mixed_count': counts['mixed'], 'pending_count': counts['pending'], 'unavailable_count': counts['unavailable'],
        'discard_count': counts['discard'], 'unconfirmed_client_count': counts['unconfirmed'],
        'checked_date': '20 Sep 2026',
        'drive_scope': 'Carpeta Yabuuchi Sushi y sus 6 carpetas · grabaciones del 9 y 14 de septiembre',
        'drive_folders': drive['summary']['folders'],
        'excluded_shortcut_records': drive['summary']['shortcuts'],
        'excluded_proxy_records': drive['summary']['proxies'],
        'sha256_duplicate_groups': [ids for ids in hash_groups.values() if len(ids) > 1],
        'review_method': 'Identificación visual por muestras distribuidas y rangos detallados. Revisar movimiento y foco del tramo exacto antes de montarlo.',
        'storage': 'Los originales del 9 de septiembre están en Extreme SSD; mantenerlo conectado para reproducirlos o descargarlos. Las vistas previas son locales.',
        'usage_scope': 'B-roll de la selección actual y videos adicionales vigentes; no cuenta versiones archivadas ni equivale a publicación.',
    }
    if clean_manifest:
        summary.update(clean_source_count=clean_manifest['summary']['source_count'],
                       clean_segment_count=clean_manifest['summary']['segment_count'],
                       clean_package_url=clean_manifest['summary']['package_url'],
                       clean_version=clean_manifest['version'],
                       clean_format=clean_manifest['summary']['format'],
                       storage='B-rolls recortados y originales del 9 de septiembre en Extreme SSD. Mantenerlo conectado para descargarlos o editar. Vistas previas locales.')
    data = {'schema_version': 2, 'client': 'Yabuuchi Sushi', 'summary': summary, 'items': items,
            'uses': uses, 'current_selection': {'count': len(manifest['items']), 'manifest': 'runs/yabuuchi-selection-manifest.json', 'uses': uses}}
    encoded = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    backup = INDEX.with_name('broll-index-before-library.json')
    if INDEX.exists() and not backup.exists():
        shutil.copy2(INDEX, backup)
    INDEX.write_text(encoded)
    (OUT / 'catalogo.json').write_text(encoded)
    template = (ROOT / 'templates/yabuuchi-library.html').read_text()
    page = template.replace('__DATA_JSON__', encoded.replace('<', '\\u003c'))
    (OUT / 'index.html').write_text(page)
    headers = ['Código', 'Título', 'Tipo', 'Categoría', 'Etiquetas', 'Ubicación', 'Lote', 'Duración original (s)', 'Tramo', 'Entrada original (s)', 'Salida original (s)', 'Notas del tramo', 'Cautela del archivo', 'Usado en videos actuales', 'Familia de escena', 'Archivo original', 'Ruta original', 'Drive', 'SHA256 original', 'Archivo recortado', 'Ruta de edición', 'Entrada recorte (s)', 'Salida recorte (s)']
    with (OUT / 'catalogo.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f); writer.writerow(headers)
        for item in items:
            for segment in item['segments'] or [{}]:
                clip = segment.get('clip', {})
                writer.writerow([item['id'].split('_')[-2], item['title'], item['kind'], item['category'], ', '.join(item['tags']), item['location'], item['batch'], item.get('duration', ''), segment.get('label', ''), segment.get('in', ''), segment.get('out', ''), segment.get('notes', ''), item.get('caution', ''), '; '.join(u['title'] for u in item['uses']), item['scene_family'], item['filename'], item['source'], item['drive_url'], item.get('sha256', ''), clip.get('filename',''), clip.get('source', item['source']), 0 if clip else '', clip.get('duration','')])
    lines = ['# Biblioteca B-roll · Yabuuchi Sushi', '',
             f"{summary['source_count']} originales catalogados; {summary['available_count']} reproducibles; {summary['broll_count']} con {summary['segment_count']} tramos de apoyo; {summary['unavailable_count']} archivo incompleto.", '',
             'Vista: http://127.0.0.1:3046/yabuuchi-library/index.html', '',
             'Buscar: `python3 scripts/build_yabuuchi_library.py --search "queso crema"`', '',
             summary['drive_scope'], summary['storage'], '',
             'Los rangos están en segundos del original. Son sugerencias basadas en muestras visuales: comprobar movimiento, foco y bocas hablando antes de cortar. Silenciar audio del B-roll. Priorizar pertinencia y luego tomas/familias menos usadas. No atribuir otra sede ni nombres de productos sin evidencia.', '',
             'Los proxies LRF, accesos directos, fotos y outro están separados del inventario de originales. No se cuentan como tomas nuevas. Los destinos de accesos directos no los expone el conector; no se afirma haber inspeccionado carpetas ajenas al cliente.', '']
    if clean_manifest:
        lines[2] = f"{summary['source_count']} originales archivados; {summary['clean_source_count']} B-rolls limpios y {summary['clean_segment_count']} tramos físicos recortados, sin audio."
        lines += ['Usar la ruta del tramo recortado, desde 0 hasta su duración; los tiempos originales se conservan para trazabilidad. Las notas del original pueden referirse a partes ya excluidas.', '']
    for item in items:
        lines += [f"## {item['title']} · {item['id'].split('_')[-2]}", '', item['description'], '',
                  f"- Tipo: {item['kind']} · {item['location']} · {item['batch']}",
                  f"- Original: `{item['source']}`", f"- Etiquetas: {', '.join(item['tags'])}",
                  f"- Usado en: {', '.join(u['title'] for u in item['uses']) or 'ninguno de los cuatro actuales'}"]
        lines += [f"- {s['in']:.2f}–{s['out']:.2f} s: {s['label']}. {s.get('notes', '')}" for s in item['segments']]
        if item.get('clean'):
            lines += [f"- B-roll recortado: `{item['clean']['source']}` ({item['clean']['duration']:.2f} s, sin audio)."]
            lines += [f"- Tramo listo: `{s['clip']['source']}` (0–{s['clip']['duration']:.2f} s)." for s in item['segments']]
        if item.get('caution'): lines += ['- Nota: ' + item['caution']]
        lines.append('')
    (ROOT / 'media/yabuuchi/BROLL-YABUUCHI.md').write_text('\n'.join(lines))
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--search')
    args = parser.parse_args()
    if args.search:
        data = read(INDEX)
        words = norm(args.search).split()
        for item in data['items']:
            hay = norm(json.dumps(item, ensure_ascii=False))
            if item['kind'] in ('broll', 'mixed') and item['segments'] and all(w in hay for w in words):
                print(f"{item['title']} | {item['used_in_count']} videos actuales | {item.get('clean', {}).get('source', item['source'])}")
                for s in item['segments']:
                    if s.get('clip'):
                        print(f"  0–{s['clip']['duration']:.2f}s {s['label']} | {s['clip']['source']} | original {s['in']:.2f}–{s['out']:.2f}s")
                    else:
                        print(f"  {s['in']:.2f}–{s['out']:.2f}s {s['label']}")
                print('  Nota: ' + item.get('caution', 'Silenciar audio.'))
    else:
        print(json.dumps(build()['summary'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
