#!/usr/bin/env python3
"""One client context, one editorial plan for a batch, resumable local execution."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import subprocess
import tempfile

import audiokit
import editkit
import pipeline
from local_transcription import transcribe

ROOT = Path(__file__).resolve().parent


def read(path):
    return json.loads(Path(path).read_text())


def save(path, data):
    path = Path(path)
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, allow_nan=False)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def resolve(path, base=None):
    return ((base or ROOT) / path).resolve()


@contextmanager
def locked(path):
    with Path(path).open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Este trabajo local ya está en ejecución; no lanzar otro.')
        yield


def scoped_rules(slug):
    """Keep global sections and this client; unknown sections remain visible."""
    text = (ROOT / 'AGENTS.md').read_text()
    sections = re.split(r'(?m)(?=^#{1,2} )', text)
    names = {'nanas': ('nana',), 'arecibo': ('arecibo',), 'yabuuchi': ('yabuuchi',),
             'delian': ('delian',), 'truco': ('truco',), 'cheesys': ('cheesys',)}
    globals_ = ('aprender de', 'teléfono en', 'edit kit', 'audio kit',
                'kit reutilizable', 'música única', 'comprobar publicación',
                'uso de ai', 'lotes de edición')
    selected = []
    early_nanas = True
    for section in sections:
        heading = section.split('\n', 1)[0].lower()
        if heading.startswith('# arecibo'):
            early_nanas = False
        owners = {key for key, terms in names.items() if any(t in heading for t in terms)}
        global_section = any(t in heading for t in globals_)
        if global_section or slug in owners or (not owners and (not early_nanas or slug == 'nanas')):
            selected.append(section)
    return ''.join(selected)


def context(client):
    profile = editkit.load_profile(client)
    paths = [ROOT / 'styles/clients.json', ROOT / 'AGENTS.md',
             ROOT / profile['style'], ROOT / profile['feedback'], ROOT / 'styles/audio-master.json']
    editor_guide = ROOT / profile['editor_guide'] if profile.get('editor_guide') else None
    caption_policy = ROOT / 'CAPTIONS-POR-CLIENTE.md'
    paths.append(caption_policy)
    if editor_guide:
        paths.append(editor_guide)
    if profile.get('audio'):
        paths.append(ROOT / profile['audio'])
    catalogs = list(dict.fromkeys([profile.get('catalog'), *profile.get('extra_catalogs', [])]))
    ideas = []
    for rel in filter(None, catalogs):
        path = ROOT / rel
        paths.append(path)
        if path.is_file():
            for item in read(path).get('ideas', []):
                ideas.append({**item, '_catalog': rel})
    indexes = list(dict.fromkeys([*profile.get('resource_indexes', []), 'styles/music-usage.json']))
    resources = {}
    for rel in indexes:
        path = ROOT / rel
        paths.append(path)
        resources[rel] = {'exists': path.is_file(), 'read_when_needed': str(path)}
    versions = editkit.status(profile)
    source_dirs = profile.get('source_dirs') or [profile.get('source_dir', profile.get('media', 'media'))]
    media = sorted({str(p.resolve()) for directory in source_dirs for p in (ROOT / directory).glob('*')
                    if p.is_file() and p.suffix.lower() in ('.mp4', '.mov', '.m4v')})
    transcript_dir = ROOT / profile.get('transcript_dir', 'runs')
    transcripts = [str(p.resolve()) for p in sorted(transcript_dir.glob('*.json'))
                   if profile.get('transcript_dir') or 'transcript' in p.name]
    files = {str(p): audiokit.digest(p) if p.is_file() else None for p in paths}
    return {'profile': profile, 'style': read(ROOT / profile['style']),
            'caption_policy': caption_policy.read_text() if caption_policy.is_file() else '',
            'editor_guide': editor_guide.read_text() if editor_guide and editor_guide.is_file() else 'Pendiente: completar ficha de captions del cliente antes de editar.',
            'feedback': read(ROOT / profile['feedback']), 'rules': scoped_rules(profile['slug']),
            'ideas': ideas, 'existing_edits': versions, 'resources': resources,
            'available_sources': media, 'available_transcripts': transcripts,
            'instruction_files': files,
            'policy': 'Una decisión editorial por lote; ejecución local. Revisión y publicación separadas.'}


def request_metricool_style(client, folder, reason):
    """Read-only lookup once per batch; style extraction remains an editorial task."""
    folder = Path(folder).resolve()
    if (folder / 'batch.json').exists():
        raise ValueError('Ya existe un lote en esa carpeta.')
    folder.mkdir(parents=True, exist_ok=True)
    request_path = folder / 'style-request.json'
    if request_path.exists():
        return read(request_path)
    registry = editkit.load_registry()
    key = client.strip().lower()
    match = next((c for c in registry['clients'] if key in {
        str(v).lower() for v in [c['slug'], c.get('name', ''), c.get('client_id', ''), *c.get('aliases', [])]}), None)
    lookup = (match.get('client_id') or match['name']) if match else client
    out = folder / 'metricool'
    command = ['node', str(ROOT / 'scripts/metricool_tomorrow.mjs'),
               '--client', lookup, '--history-only', '--out', str(out)]
    result = {'status': 'needs_style_reference', 'client': client, 'reason': str(reason),
              'report': str(out / 'report.json'), 'approval': 'pending',
              'next_action': 'Revisar videos publicados, guardar perfil y archivo de captions del cliente, repetir start en esta carpeta.',
              'frames_command': ['python3', str(ROOT / 'scripts/grab_metricool_style.py'),
                                 '--report', str(out / 'report.json'), '--out', str(out / 'style')]}
    try:
        response = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
        if response.returncode or not (out / 'report.json').is_file():
            result['lookup'] = 'failed'
            result['issue'] = 'No se pudo consultar Metricool; comprobar acceso y nombre/ID exacto. No se aplicó otro estilo.'
        else:
            report = read(out / 'report.json')
            clients = report.get('clients', [])
            found = any(c.get('last10') for c in clients)
            result['lookup'] = 'published_posts_found' if found else 'no_published_references'
            if any(c.get('metricool_error') for c in clients):
                result['lookup'] = 'failed'
            result['fetched_at'] = report.get('fetched_at')
    except (OSError, subprocess.TimeoutExpired):
        result['lookup'] = 'failed'
        result['issue'] = 'Consulta no disponible o agotó el tiempo; continuar la búsqueda con acceso verificado.'
    save(request_path, result)
    return result


def start(client, prompt, count, folder):
    if count < 1 or count > 20:
        raise ValueError('El lote admite entre 1 y 20 videos.')
    token(Path(folder).name)
    folder = Path(folder).resolve()
    try:
        ctx = context(client)
    except editkit.StyleReferenceNeeded as error:
        result = request_metricool_style(client, folder, error)
        result.update(prompt=prompt, count=count)
        save(folder / 'style-request.json', result)
        return result
    if folder.exists():
        if not (folder / 'style-request.json').is_file() or (folder / 'batch.json').exists():
            raise ValueError('La carpeta ya existe; usar otra para un nuevo lote.')
    else:
        folder.mkdir(parents=True, exist_ok=False)
    save(folder / 'context.json', ctx)
    save(folder / 'batch.json', {'version': 1, 'client': ctx['profile']['slug'], 'prompt': prompt,
                               'count': count, 'jobs': [], 'created_at': datetime.now(timezone.utc).isoformat()})
    (folder / 'BRIEF.md').write_text(
        '# Lote de edición\n\n' + prompt + '\n\n'
        '1. Leer context.json una sola vez: reglas globales y del cliente, perfil vigente, '
        'correcciones, ideas y versiones existentes. Los índices de B-roll/música se consultan '
        'una vez para el lote según necesidad.\n'
        '2. Seleccionar los videos juntos mediante select y ejecutar prepare.\n'
        '3. Leer prepared.json y las muestras visuales pertinentes. Escribir todas las '
        'decisiones en un solo JSON y ejecutar compose seguido de run.\n'
        '4. Abrir review.html y revisar cada export completo. Corregir solo los afectados; '
        'compose acepta un subconjunto y crea versiones nuevas.\n\n'
        'El programa no elige escenas por nombre ni declara aprobación audiovisual.\n')
    return {'batch': str(folder), 'context': str(folder / 'context.json'), 'count': count}


def fresh(folder):
    ctx = read(folder / 'context.json')
    for name, expected in ctx['instruction_files'].items():
        path = Path(name)
        actual = audiokit.digest(path) if path.is_file() else None
        if actual != expected:
            raise ValueError('Cambiaron instrucciones o catálogos. Ejecutar refresh y revisar el contexto actualizado.')
    return ctx


def token(value):
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', value):
        raise ValueError('El identificador debe usar letras, números, guiones o guiones bajos.')
    return value


def select(folder, spec):
    ctx = fresh(folder)
    state = read(folder / 'batch.json')
    if state['jobs']:
        raise ValueError('El lote ya tiene selección; conservarlo o crear un lote nuevo.')
    if len(spec) != state['count']:
        raise ValueError('Seleccionar exactamente la cantidad solicitada.')
    jobs, seen = [], set()
    for item in spec:
        name = token(item['id'])
        if name in seen:
            raise ValueError('Video repetido en el lote.')
        seen.add(name)
        candidates = [x for x in ctx['ideas'] if x['id'] == item['idea_id']]
        if not candidates:
            raise ValueError(f'Idea fuera del catálogo del cliente: {item["idea_id"]}')
        if any(x.get('do_not_reedit') or x.get('skip_as_new_reel') for x in candidates):
            raise ValueError(f'Idea protegida contra reedición: {name}')
        catalog = item.get('catalog') or candidates[-1]['_catalog']
        if catalog not in {x['_catalog'] for x in candidates}:
            raise ValueError('Catálogo incompatible con la idea.')
        source = resolve(item['source'])
        if not source.is_file():
            raise ValueError(f'Falta original: {source}')
        transcript = resolve(item['transcript']) if item.get('transcript') else folder / (name + '-transcript.json')
        if item.get('transcript') and not transcript.is_file():
            raise ValueError(f'Falta transcripción indicada: {transcript}')
        jobs.append({'id': name, 'idea_id': item['idea_id'], 'catalog': catalog,
                     'title': item.get('title') or candidates[-1].get('title', name),
                     'source': str(source), 'transcript': str(transcript),
                     'model': item.get('model', 'base'), 'initial_prompt': item.get('initial_prompt'),
                     'publication_check': item.get('publication_check', 'not_verified'),
                     'status': 'selected'})
    state['jobs'] = jobs
    save(folder / 'batch.json', state)
    return summary(folder)


def prepare(folder):
    fresh(folder)
    state = read(folder / 'batch.json')
    prepared = []
    for job in state['jobs']:
        try:
            path = Path(job['transcript'])
            if not path.exists():
                transcribe(job['source'], path, job['model'], job['initial_prompt'])
            transcript = read(path)
            words = editkit.transcript_words(transcript)
            if not words and transcript.get('caption_mode') != 'editorial':
                raise ValueError('Sin tiempos por palabra; revisar transcripción.')
            prepared.append({'id': job['id'], 'source': job['source'], 'transcript': str(path),
                             'text': transcript.get('text') or ' '.join(w['word'].strip() for w in words),
                             'segments': [{'start': s.get('start'), 'end': s.get('end'), 'text': s.get('text')}
                                          for s in transcript.get('segments', [])],
                             'publication_check': job['publication_check']})
            if job['status'] in ('selected', 'prepare_failed'):
                job['status'] = 'needs_editorial_plan'
            job.pop('error', None)
        except Exception as error:
            job.update(status='prepare_failed', error=str(error))
        save(folder / 'batch.json', state)
    save(folder / 'prepared.json', prepared)
    return summary(folder)


def compose(folder, decisions):
    ctx = fresh(folder)
    state = read(folder / 'batch.json')
    by_id = {j['id']: j for j in state['jobs']}
    staged = []
    seen = set()
    # Validate the complete plan before writing any recipes.
    for decision in decisions:
        name = decision['id']
        if name not in by_id or name in seen:
            raise ValueError('Identificador desconocido o repetido en decisiones.')
        seen.add(name)
        job = by_id[name]
        if not decision.get('editorial_note'):
            raise ValueError('Registrar la decisión editorial del video.')
        if any(x.get('do_not_reedit') or x.get('skip_as_new_reel') for x in ctx['ideas'] if x['id'] == job['idea_id']):
            raise ValueError('Esta idea está protegida contra reedición.')
        profile = ctx['profile']
        recipe = editkit.scaffold_recipe(profile, job['idea_id'], job['source'], job['transcript'],
                                          decision['clips'], job['title'])
        recipe['catalog'] = job['catalog']
        # Only editorial fields: client, source, transcript and style stay bound to the batch.
        allowed = {'captions', 'broll', 'graphics', 'sounds', 'effects', 'music', 'audio_master', 'caption_mode'}
        unknown = set(decision) - allowed - {'id', 'clips', 'editorial_note'}
        if unknown:
            raise ValueError(f'Campos no admitidos: {sorted(unknown)}')
        for field in allowed & decision.keys():
            recipe[field] = decision[field]
        meta = pipeline.probe(job['source'])
        pipeline.validate_edit(recipe['clips'], float(meta['format']['duration']), pipeline.max_zoom_for(meta))
        if not recipe.get('captions'):
            recipe['captions'] = editkit.draft_captions(
                editkit.transcript_words(read(job['transcript'])), recipe['clips'], ctx['style'],
                profile.get('caption_case', 'natural'))
        if not recipe['captions']:
            raise ValueError('Faltan captions; revisar el plan antes de renderizar.')
        duration = sum(c['out'] - c['in'] for c in recipe['clips'])
        pipeline.cut_words(editkit.transcript_words(read(job['transcript'])), recipe['clips'])
        for caption in recipe['captions']:
            if not 0 <= caption['start'] < caption['end'] <= duration + .01:
                raise ValueError('Caption fuera del montaje; corregir antes del render.')
        audiokit.settings(recipe)
        recipe['review_notes'].append(decision['editorial_note'])
        family = f'{profile["slug"]}-batch-{token(folder.name)}-{token(name)}'
        dest = editkit.next_free_path(ROOT / 'edits' / (family + '-v0.json'))
        staged.append((job, dest, recipe))
    for job, dest, recipe in staged:
        editkit.write_new(dest, recipe)
        if job.get('recipe'):
            job.setdefault('history', []).append({k: job[k] for k in ('recipe', 'output', 'status') if k in job})
        job.update(recipe=str(dest), output=str(folder / (dest.stem + '.mp4')), status='ready',
                   context_sha256=audiokit.digest(folder / 'context.json'))
        job.pop('fingerprint', None)
        job.pop('error', None)
        save(folder / 'batch.json', state)
    return summary(folder)


def fingerprint(recipe_path):
    """Bind checkpoints to the recipe and file identities, without re-reading large media."""
    path = Path(recipe_path)
    recipe = read(path)
    dependencies = [path, ROOT / 'styles/audio-master.json', ROOT / 'pipeline.py',
                    ROOT / 'audiokit.py', ROOT / 'review_loop.py', ROOT / 'effects.py', ROOT / 'graphics.py']
    for field in ('source', 'transcript', 'style'):
        if recipe.get(field):
            dependencies.append(resolve(recipe[field], path.parent))
    style_path = resolve(recipe['style'], path.parent)
    dependencies.append(resolve(read(style_path)['font_file'], style_path.parent))
    for entry in [recipe.get('music'), recipe.get('outro'), *recipe.get('broll', []), *recipe.get('graphics', [])]:
        if entry and entry.get('source'):
            dependencies.append(resolve(entry['source'], path.parent))
    dependencies.append(resolve(recipe.get('catalog', 'runs/catalog.json')))
    dependencies.extend(resolve(p) for p in recipe.get('references', {}).values())
    identities = []
    for dep in dependencies:
        s = dep.stat()
        identities.append((str(dep), s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns))
    return hashlib.sha256(json.dumps(identities).encode()).hexdigest()


def verified(job):
    output = Path(job['output'])
    if not output.is_file():
        return False
    try:
        audio = read(output.with_suffix('.audio.json'))
        review = read(output.with_suffix('.review.json'))
        report = read(output.with_suffix('.json'))
        actual = audiokit.digest(output)
        return (audio.get('status') == 'pass' and audio.get('output_sha256') == actual
                and review.get('output_sha256') == actual
                and report.get('verification', {}).get('full_decode') is True
                and report.get('edit') == read(job['recipe'])
                and any(n.get('id') == 'technical_check' and n.get('status') == 'pass'
                        for n in review.get('nodes', [])))
    except (OSError, ValueError):
        return False


def run_batch(folder):
    ctx = fresh(folder)
    state = read(folder / 'batch.json')
    with locked(ROOT / 'runs/.batch-render.lock'):
        for job in state['jobs']:
            if not job.get('recipe'):
                continue
            try:
                if job.get('context_sha256') != audiokit.digest(folder / 'context.json'):
                    raise ValueError('Cambió el contexto del cliente; revisar el plan mediante compose.')
                recipe = read(job['recipe'])
                if resolve(recipe['style'], Path(job['recipe']).parent) != resolve(ctx['profile']['style']):
                    raise ValueError('La receta usa un estilo anterior; actualizar mediante compose.')
                current = fingerprint(job['recipe'])
                if job.get('fingerprint') and job['fingerprint'] != current:
                    raise ValueError('Cambió una entrada; compose requiere una nueva revisión del video afectado.')
                if Path(job['output']).exists():
                    if job.get('fingerprint') == current and verified(job):
                        job.update(status='review_pending')
                        job.pop('error', None)
                        save(folder / 'batch.json', state)
                        continue
                    raise ValueError('Existe un export sin controles completos; conservar y crear nueva revisión con compose.')
                job.update(status='rendering', fingerprint=current)
                save(folder / 'batch.json', state)
                pipeline.render(Path(job['recipe']), Path(job['output']))
                if fingerprint(job['recipe']) != current:
                    raise ValueError('Una entrada cambió durante el render; crear nueva revisión.')
                if not verified(job):
                    raise ValueError('Export sin controles técnicos completos.')
                job.update(status='review_pending')
                job.pop('error', None)
            except Exception as error:
                job.update(status='render_failed', error=str(error))
            save(folder / 'batch.json', state)
    gallery(folder, state)
    return summary(folder)


def gallery(folder, state):
    cards = []
    for job in state['jobs']:
        title = html.escape(job['title'])
        status = html.escape(job['status'])
        video = ''
        if job.get('output') and Path(job['output']).is_file():
            video = f'<video controls preload="none" src="{html.escape(Path(job["output"]).name, quote=True)}"></video>'
        cards.append(f'<article><h2>{title}</h2><p>{status}</p>{video}<p>{html.escape(job.get("error", ""))}</p></article>')
    (folder / 'review.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisión del lote</title>'
        '<style>body{font:16px system-ui;max-width:1100px;margin:30px auto;padding:20px;background:#111;color:#eee}'
        'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}'
        'video{width:100%;max-height:600px}article{padding:16px;background:#222;border-radius:12px}</style>'
        '<h1>Revisión del lote</h1><p>Ver y escuchar cada video completo. Aprobación y publicación pendientes.</p>'
        '<main>' + ''.join(cards) + '</main></html>')


def summary(folder):
    state = read(folder / 'batch.json')
    return {'batch': str(folder), 'requested': state['count'], 'selected': len(state['jobs']),
            'jobs': [{k: j[k] for k in ('id', 'status', 'error', 'output') if k in j} for j in state['jobs']],
            'review': str(folder / 'review.html'), 'approval': 'pending'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    p = commands.add_parser('start')
    p.add_argument('client'); p.add_argument('--prompt', required=True)
    p.add_argument('--count', type=int, default=3); p.add_argument('--folder', type=Path, required=True)
    for name in ('select', 'prepare', 'compose', 'run', 'status', 'refresh'):
        p = commands.add_parser(name); p.add_argument('folder', type=Path)
        if name in ('select', 'compose'):
            p.add_argument('spec', type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == 'start':
            result = start(args.client, args.prompt, args.count, args.folder)
        else:
            folder = args.folder.resolve()
            with locked(folder / '.batch.lock'):
                if args.command in ('select', 'compose'):
                    result = globals()[args.command](folder, read(args.spec))
                elif args.command == 'refresh':
                    save(folder / 'context.json', context(read(folder / 'batch.json')['client']))
                    result = {'context': str(folder / 'context.json'), 'action': 'Revisar cambios antes de compose/run.'}
                else:
                    result = {'prepare': prepare, 'run': run_batch, 'status': summary}[args.command](folder)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if any(j['status'].endswith('_failed') for j in result.get('jobs', [])):
            return 1
        return 0
    except (ValueError, OSError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
