#!/usr/bin/env python3
"""Agent-facing edit helpers: global verbs, per-client profiles. Never overwrite."""
import argparse
import copy
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

from pipeline import cut_words, group_captions, probe, validate_broll, validate_edit

ROOT = Path(__file__).resolve().parent
CLIENTS_FILE = ROOT / 'styles' / 'clients.json'
LEARNED_FILE = ROOT / 'styles' / 'metricool-learned.json'
LEARNED_STYLE_DIR = ROOT / 'styles' / 'learned'
HOUSE_FONT = Path('media/frida/brand/BreeSerif-Regular.ttf')
VERSION_RE = re.compile(r'^(.*)-v(\d+)$')
SKIP_IDEA_STATUS = {'descartada', 'publicada'}


def dump(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))


def rel_to_edits(path):
    return Path(os.path.relpath(Path(path).resolve(), (ROOT / 'edits').resolve())).as_posix()


def load_registry(path=None):
    return json.loads(Path(path or CLIENTS_FILE).read_text())


class StyleReferenceNeeded(ValueError):
    """The agent must inspect this client's published Metricool videos."""


def load_learned(path=None):
    return json.loads(Path(path or LEARNED_FILE).read_text())


def fold_name(value):
    text = unicodedata.normalize('NFKD', value or '')
    text = ''.join(char for char in text if not unicodedata.combining(char))
    text = text.lower().replace('’', "'").replace("'", '')
    return re.sub(r'[^a-z0-9]+', '', text)


def match_learned(slug, learned):
    key = fold_name(slug)
    if not key:
        return None
    for entry in learned.get('clients', []):
        names = {fold_name(entry.get('slug', '')), fold_name(entry.get('name', ''))}
        if key in names:
            return entry
    return None


def build_learned_style(entry, house):
    """Caption file for a client known from published videos, not from another client."""
    style = copy.deepcopy(house['captions_default'])
    style['font_family'] = 'Bree Serif'
    # styles/learned/<slug>.json -> repo media. OFL face already in the repo.
    style['font_file'] = '../../' + HOUSE_FONT.as_posix()
    style.setdefault('max_words', 4)
    style.setdefault('max_chars', 28)
    for key in ('primary_colour', 'outline_colour', 'font_size', 'bottom_margin', 'alignment', 'outline'):
        if entry.get(key) is not None:
            style[key] = entry[key]
    style['family'] = entry['family']
    style['notes'] = [entry.get('notes', '')]
    if entry.get('family') == 'process_silent':
        style['caption_mode'] = 'none'
    return style


def learned_profile(entry):
    return {
        'slug': entry['slug'],
        'name': entry['name'],
        'style': f"styles/learned/{entry['slug']}.json",
        'recipe_prefix': entry['slug'],
        'caption_case': entry.get('caption_case', 'natural'),
        'whoosh_on_broll': False,
        'learned_family': entry.get('family'),
        'source': 'metricool-learned',
    }


def ensure_learned_style(entry, house, dest_dir=None):
    folder = Path(dest_dir or LEARNED_STYLE_DIR)
    dest = folder / f"{entry['slug']}.json"
    if dest.exists():
        return dest
    folder.mkdir(parents=True, exist_ok=True)
    write_new(dest, build_learned_style(entry, house))
    return dest


def load_profile(slug, registry=None, learned=None, write_style=True):
    registry = registry or load_registry()
    key = (slug or '').strip().lower()
    folded = fold_name(slug)
    for client in registry['clients']:
        names = [client['slug'], client.get('name', ''), *client.get('aliases', [])]
        exact = {name.strip().lower() for name in names if name}
        if key in exact or (folded and folded in {fold_name(name) for name in names if name}):
            return current_profile(client)
        if client.get('client_id') and key == client['client_id'].lower():
            return current_profile(client)
    learned = load_learned() if learned is None else learned
    entry = match_learned(slug, learned)
    if entry:
        if write_style:
            ensure_learned_style(entry, learned['house'])
        return learned_profile(entry)
    known = ', '.join(c['slug'] for c in registry['clients'])
    raise StyleReferenceNeeded(
        f'Cliente sin perfil ni referencia publicada: {slug}. '
        f'Buscar sus videos publicados en Metricool antes de inventar captions. Perfiles locales: {known}.'
    )


def classify_pending(payload, registry, learned):
    """Ideas with raw footage and no uploaded edit. Does not pick shots or colours."""
    rows = []
    for idea in payload.get('ideas', []):
        if idea.get('status') in SKIP_IDEA_STATUS:
            continue
        raws = list(idea.get('raws') or [])
        if not raws or idea.get('edited'):
            continue
        name = (idea.get('client_name') or '').strip()
        blockers = []
        try:
            profile = load_profile(name, registry, learned, write_style=False)
            style_source = profile.get('source', 'profile')
            slug = profile['slug']
            family = profile.get('learned_family')
        except ValueError:
            style_source = 'missing'
            slug = None
            family = None
            blockers.append('falta referencia publicada para captions')
        providers = {raw.get('provider') for raw in raws}
        if 'drive' in providers:
            blockers.append('el crudo está en Drive, no se baja por R2')
        if any(not raw.get('bytes') for raw in raws):
            blockers.append('el dashboard tiene un crudo de 0 bytes')
        downloadable = [raw['id'] for raw in raws if raw.get('provider') == 'r2' and raw.get('bytes')]
        rows.append({
            'client_id': idea.get('client_id'),
            'client_name': name,
            'slug': slug,
            'style_source': style_source,
            'family': family,
            'idea_id': idea.get('idea_id'),
            'title': idea.get('title'),
            'status': idea.get('status'),
            'raws': len(raws),
            'downloadable': downloadable,
            'blockers': blockers,
        })
    return rows


def summarize_pending(rows):
    grouped = {}
    for row in rows:
        slot = grouped.setdefault(row['client_name'], {
            'client_name': row['client_name'],
            'client_id': row['client_id'],
            'slug': row['slug'],
            'style_source': row['style_source'],
            'family': row['family'],
            'ideas': 0,
            'downloadable': 0,
            'blocked': 0,
            'blockers': [],
        })
        slot['ideas'] += 1
        slot['downloadable'] += len(row['downloadable'])
        if row['blockers']:
            slot['blocked'] += 1
            for blocker in row['blockers']:
                if blocker not in slot['blockers']:
                    slot['blockers'].append(blocker)
    return sorted(grouped.values(), key=lambda item: (-item['ideas'], item['client_name']))


def current_profile(client):
    """An explicit current_style in feedback is the authoritative client binding."""
    result = copy.deepcopy(client)
    feedback = ROOT / client.get('feedback', '')
    if feedback.is_file():
        current = json.loads(feedback.read_text()).get('current_style')
        if current:
            if not (ROOT / current).is_file():
                raise StyleReferenceNeeded(f'Falta el estilo vigente: {current}; buscar referencia en Metricool.')
            result['style'] = current
    if not result.get('style') or not (ROOT / result['style']).is_file():
        raise StyleReferenceNeeded('Falta el archivo de captions del cliente; buscar referencia en Metricool.')
    return result


def parse_version(stem):
    match = VERSION_RE.match(stem)
    if not match:
        raise ValueError(f'Sin versión en el nombre: {stem}')
    return match.group(1), int(match.group(2))


def next_free_path(path):
    path = Path(path)
    family, _ = parse_version(path.stem)
    versions = []
    for item in path.parent.glob(f'{family}-v*.json'):
        try:
            _, number = parse_version(item.stem)
        except ValueError:
            continue
        versions.append(number)
    dest = path.with_name(f'{family}-v{max(versions, default=0) + 1}.json')
    if dest.exists():
        raise ValueError(f'Ya existe {dest.name}; no se pisa')
    return dest


def family_name(profile, idea):
    prefix = profile.get('recipe_prefix') or ''
    return f'{prefix}-{idea}' if prefix else idea


def transcript_words(data):
    return [word for segment in data.get('segments', []) for word in segment.get('words', [])]


def belongs_to(profile, path, data):
    if profile.get('client_id') and data.get('client_id') == profile['client_id']:
        return True
    if profile.get('name') and data.get('client') == profile['name']:
        return True
    prefix = profile.get('recipe_prefix') or ''
    if prefix and path.stem.startswith(prefix + '-'):
        return True
    style = str(data.get('style', ''))
    return profile['slug'] in Path(style).stem


def iter_recipes(edits_dir=None):
    folder = Path(edits_dir or ROOT / 'edits')
    for path in sorted(folder.glob('*.json')):
        try:
            yield path, json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue


def status(profile, idea=None, edits_dir=None):
    families = {}
    needle = (idea or '').lower()
    for path, data in iter_recipes(edits_dir):
        if not belongs_to(profile, path, data):
            continue
        try:
            family, number = parse_version(path.stem)
        except ValueError:
            continue
        if needle and needle not in family.lower() and needle != str(data.get('idea_id', '')).lower():
            continue
        current = families.get(family)
        if not current or number > current['version']:
            families[family] = {
                'family': family,
                'version': number,
                'recipe': path.name if edits_dir else str(path.relative_to(ROOT)),
                'title': data.get('title'),
                'idea_id': data.get('idea_id'),
                'next': f'{family}-v{number + 1}.json',
            }
    return sorted(families.values(), key=lambda item: item['family'])


def inspect_recipe(edit, path=None):
    clips = edit.get('clips') or []
    info = {
        'path': None if path is None else str(path),
        'client_id': edit.get('client_id'),
        'client': edit.get('client'),
        'idea_id': edit.get('idea_id'),
        'title': edit.get('title'),
        'style': edit.get('style'),
        'source': edit.get('source'),
        'transcript': edit.get('transcript'),
        'clips': clips,
        'timeline': round(sum(clip['out'] - clip['in'] for clip in clips), 3),
        'captions': len(edit.get('captions') or []),
        'broll': [{'at': layer.get('at'), 'in': layer.get('in'), 'out': layer.get('out'),
                   'source': layer.get('source'), 'reason': layer.get('reason')}
                  for layer in edit.get('broll') or []],
        'outro': edit.get('outro'),
        'review_notes': edit.get('review_notes') or [],
    }
    if path is not None:
        try:
            family, number = parse_version(Path(path).stem)
            info.update(family=family, version=number, next=f'{family}-v{number + 1}.json')
        except ValueError:
            info.update(family=None, version=None, next=None)
    return info


def window_words(words, start, end):
    mapped = cut_words(words, [{'in': start, 'out': end}])
    return {
        'source_in': start,
        'source_out': end,
        'duration': round(end - start, 3),
        'text': ' '.join(word['word'].strip() for word in mapped),
        'words': mapped,
    }


def caption_colour(text, style):
    stripped = text.rstrip()
    if style.get('prompt_colour') and stripped.endswith('?'):
        return style['prompt_colour']
    return style.get('answer_colour')


def draft_captions(words, clips, style, caption_case='natural'):
    mapped = cut_words(words, clips)
    groups = group_captions(
        mapped,
        style.get('max_words', 3),
        style.get('max_chars', 22),
        uppercase=(caption_case == 'upper'),
    )
    duration = sum(clip['out'] - clip['in'] for clip in clips)
    for group in groups:
        group['end'] = min(group['end'], duration)
        group['start'] = round(group['start'], 3)
        group['end'] = round(group['end'], 3)
        colour = caption_colour(group['text'], style)
        if colour:
            group['primary_colour'] = colour
    return groups


def scaffold_recipe(profile, idea, source, transcript, clips=None, title=None):
    source = Path(source)
    transcript = Path(transcript)
    defaults = profile.get('defaults') or {}
    clips = copy.deepcopy(clips or [])
    for clip in clips:
        clip.setdefault('zoom', defaults.get('zoom', 1))
        if 'audio_edge_fade' in defaults:
            clip.setdefault('audio_edge_fade', defaults['audio_edge_fade'])
    recipe = {
        'idea_id': idea,
        'title': title or idea,
        'source': rel_to_edits(source),
        'transcript': rel_to_edits(transcript),
        'style': rel_to_edits(ROOT / profile['style']),
        'clips': clips,
        'captions': [],
        'broll': [],
        'sounds': [],
        'effects': [],
        'review_notes': [
            'Borrador del Edit Kit. Revisar cortes, captions y B-roll antes de renderizar. Aprobación pendiente.'
        ],
    }
    if profile.get('client_id'):
        recipe['client_id'] = profile['client_id']
    else:
        recipe['client'] = profile['name']
    if profile.get('catalog'):
        recipe['catalog'] = profile['catalog']
    if profile.get('outro'):
        recipe['outro'] = copy.deepcopy(profile['outro'])
    if profile.get('references'):
        recipe['references'] = copy.deepcopy(profile['references'])
    if profile.get('voice_filter'):
        recipe['voice_filter'] = profile['voice_filter']
    if profile.get('learned_family') == 'process_silent':
        recipe['caption_mode'] = 'none'
        recipe['review_notes'].append('Familia process_silent: no quemar captions.')
    return recipe


def write_new(path, data):
    path = Path(path)
    if path.exists():
        raise ValueError(f'Ya existe {path.name}; no se pisa')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return path


def bump_recipe(path, note=None):
    path = Path(path)
    edit = json.loads(path.read_text())
    dest = next_free_path(path)
    result = copy.deepcopy(edit)
    if note:
        result.setdefault('review_notes', []).append(note)
    write_new(dest, result)
    return dest, result


def add_broll(edit, layer, source_duration, timeline_duration, whoosh=False):
    validate_broll(layer, source_duration, timeline_duration)
    result = copy.deepcopy(edit)
    result.setdefault('broll', []).append(layer)
    if whoosh:
        result.setdefault('sounds', []).append({
            'preset': 'whoosh_soft',
            'time': layer['at'],
            'duration': 0.18,
            'gain_db': -29,
        })
    return result


def resolve_recipe_file(edit, recipe_path, key):
    return (Path(recipe_path).parent / edit[key]).resolve()


def cmd_new(args):
    profile = load_profile(args.client)
    dest = ROOT / 'edits' / f'{family_name(profile, args.idea)}-v1.json'
    if dest.exists() or status(profile, args.idea):
        raise ValueError(f'Ya hay recetas para {args.idea}; usa bump sobre la última')
    source = Path(args.source)
    transcript = Path(args.transcript)
    if not source.is_file():
        raise ValueError(f'No está el original: {source}')
    if not transcript.is_file():
        raise ValueError(f'No está la transcripción: {transcript}')
    clips = json.loads(args.clips) if args.clips else []
    if clips:
        validate_edit(clips, float(probe(source)['format']['duration']))
    recipe = scaffold_recipe(profile, args.idea, source, transcript, clips, args.title)
    if clips:
        words = transcript_words(json.loads(transcript.read_text()))
        style = json.loads((ROOT / profile['style']).read_text())
        recipe['captions'] = draft_captions(words, clips, style, profile.get('caption_case', 'natural'))
        recipe['review_notes'].append('Captions borrador del Edit Kit; corregir transcripción antes de quemar.')
    write_new(dest, recipe)
    dump({'recipe': str(dest.relative_to(ROOT)), 'inspect': inspect_recipe(recipe, dest)})


def cmd_captions(args):
    path = args.edit.resolve()
    edit = json.loads(path.read_text())
    words = transcript_words(json.loads(resolve_recipe_file(edit, path, 'transcript').read_text()))
    style = json.loads(resolve_recipe_file(edit, path, 'style').read_text())
    profile = None
    for key in (args.client, edit.get('client'), edit.get('client_id')):
        if not key:
            continue
        try:
            profile = load_profile(key)
            break
        except ValueError:
            continue
    caption_case = (profile or {}).get('caption_case', 'natural')
    captions = draft_captions(words, edit['clips'], style, caption_case)
    if not args.apply:
        dump({'captions': captions, 'count': len(captions), 'caption_case': caption_case})
        return
    dest, result = bump_recipe(path, 'Captions borrador del Edit Kit; corregir antes de quemar.')
    result['captions'] = captions
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    dump({'recipe': str(dest.relative_to(ROOT)), 'count': len(captions)})


def cmd_broll(args):
    path = args.edit.resolve()
    edit = json.loads(path.read_text())
    source = Path(args.source)
    if not source.is_absolute():
        source = (ROOT / source).resolve()
    timeline = sum(clip['out'] - clip['in'] for clip in edit['clips'])
    layer = {
        'source': rel_to_edits(source),
        'in': args.start,
        'out': args.end,
        'at': args.at,
        'eof_action': args.eof_action,
        'reason': args.reason,
    }
    whoosh = args.whoosh if args.whoosh is not None else False
    if args.client:
        whoosh = load_profile(args.client).get('whoosh_on_broll', False) if args.whoosh is None else args.whoosh
    result = add_broll(edit, layer, float(probe(source)['format']['duration']), timeline, whoosh=whoosh)
    dest = next_free_path(path)
    result.setdefault('review_notes', []).append(f'B-roll: {args.reason}')
    write_new(dest, result)
    dump({'recipe': str(dest.relative_to(ROOT)), 'broll': layer})


def cmd_window(args):
    words = transcript_words(json.loads(args.transcript.read_text()))
    dump(window_words(words, args.start, args.end))


def cmd_inspect(args):
    path = args.edit.resolve()
    dump(inspect_recipe(json.loads(path.read_text()), path))


def cmd_bump(args):
    dest, _ = bump_recipe(args.edit.resolve(), args.note)
    dump({'recipe': str(dest.relative_to(ROOT))})


def cmd_profile(args):
    dump(load_profile(args.client))


def cmd_clients(_args):
    dump([{'slug': item['slug'], 'name': item['name'], 'style': item['style']}
          for item in load_registry()['clients']])


def fetch_pending():
    script = ROOT / 'scripts' / 'pending_queue.mjs'
    completed = subprocess.run(['node', str(script)], cwd=ROOT, capture_output=True, text=True)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise ValueError(detail or 'No se pudo leer la cola del dashboard')
    return json.loads(completed.stdout)


def cmd_queue(args):
    learned = load_learned()
    rows = classify_pending(fetch_pending(), load_registry(), learned)
    if args.client:
        needle = fold_name(args.client)
        rows = [row for row in rows if needle in {fold_name(row['client_name']), fold_name(row.get('slug') or '')}]
    for entry in learned['clients']:
        if any(row.get('slug') == entry['slug'] and row['style_source'] == 'metricool-learned' for row in rows):
            ensure_learned_style(entry, learned['house'])
    dump({'clients': summarize_pending(rows), 'ideas': rows})


def cmd_pull(args):
    rows = classify_pending(fetch_pending(), load_registry(), load_learned())
    needle = fold_name(args.client)
    chosen = [row for row in rows if needle in {fold_name(row['client_name']), fold_name(row.get('slug') or '')}]
    if not chosen:
        raise ValueError(f'No hay ideas sin editar para {args.client}')
    ids = []
    for row in chosen:
        ids.extend(row['downloadable'])
    if args.limit:
        ids = ids[:args.limit]
    if not ids:
        raise ValueError(f'{args.client} no tiene crudos en R2 que se puedan bajar')
    media_root = args.media_root or os.environ.get('PIPELINE_MEDIA_ROOT')
    if not media_root:
        external = Path('/Volumes/Extreme SSD/Nate Media/video-pipeline')
        if not external.is_dir():
            raise ValueError('Monta el Extreme SSD o pasa --media-root. El disco interno no alcanza para los crudos.')
        media_root = str(external)
    env = os.environ.copy()
    env['PIPELINE_MEDIA_ROOT'] = media_root
    completed = subprocess.run(
        ['node', 'dashboard.mjs', '--client', chosen[0]['client_id'], *ids],
        cwd=ROOT, env=env,
    )
    if completed.returncode != 0:
        raise ValueError('La descarga no terminó')
    dump({'client': chosen[0]['client_name'], 'media_root': media_root, 'videos': ids})


def cmd_status(args):
    dump(status(load_profile(args.client), args.idea))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)

    commands.add_parser('clients')
    queue = commands.add_parser('queue')
    queue.add_argument('--client')
    pull = commands.add_parser('pull')
    pull.add_argument('client')
    pull.add_argument('--limit', type=int)
    pull.add_argument('--media-root')
    profile = commands.add_parser('profile')
    profile.add_argument('client')
    listed = commands.add_parser('status')
    listed.add_argument('client')
    listed.add_argument('--idea')
    inspect = commands.add_parser('inspect')
    inspect.add_argument('edit', type=Path)
    window = commands.add_parser('window')
    window.add_argument('transcript', type=Path)
    window.add_argument('--in', dest='start', type=float, required=True)
    window.add_argument('--out', dest='end', type=float, required=True)
    captions = commands.add_parser('captions')
    captions.add_argument('edit', type=Path)
    captions.add_argument('--client')
    captions.add_argument('--apply', action='store_true')
    new = commands.add_parser('new')
    new.add_argument('client')
    new.add_argument('--idea', required=True)
    new.add_argument('--source', required=True, type=Path)
    new.add_argument('--transcript', required=True, type=Path)
    new.add_argument('--title')
    new.add_argument('--clips')
    bump = commands.add_parser('bump')
    bump.add_argument('edit', type=Path)
    bump.add_argument('--note')
    broll = commands.add_parser('broll')
    broll.add_argument('edit', type=Path)
    broll.add_argument('--source', required=True)
    broll.add_argument('--in', dest='start', type=float, required=True)
    broll.add_argument('--out', dest='end', type=float, required=True)
    broll.add_argument('--at', type=float, required=True)
    broll.add_argument('--reason', required=True)
    broll.add_argument('--eof-action', default='repeat')
    broll.add_argument('--client')
    broll.add_argument('--whoosh', action='store_true', default=None)
    broll.add_argument('--no-whoosh', dest='whoosh', action='store_false')

    args = parser.parse_args()
    commands_map = {
        'clients': cmd_clients,
        'queue': cmd_queue,
        'pull': cmd_pull,
        'profile': cmd_profile,
        'status': cmd_status,
        'inspect': cmd_inspect,
        'window': cmd_window,
        'captions': cmd_captions,
        'new': cmd_new,
        'bump': cmd_bump,
        'broll': cmd_broll,
    }
    try:
        commands_map[args.command](args)
    except ValueError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
