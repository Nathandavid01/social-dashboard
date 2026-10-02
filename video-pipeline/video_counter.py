"""Persistent unique-video count after verified local exports, with Git sync."""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
LEDGER = ROOT / 'completed-videos.json'


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def identity(edit, ledger):
    raw = str(edit.get('client_id') or edit.get('client') or '').casefold()
    style = Path(edit.get('style', '')).stem.casefold()
    for client in ledger['clients']:
        aliases = [client['key'], *client.get('aliases', [])]
        if raw in [a.casefold() for a in aliases] or (not raw and any(
                style == s or style.startswith(s + '-') for s in client.get('style_prefixes', []))):
            return client['key']
    if raw:
        return raw
    if style:
        raise ValueError('Unknown client style: provide client_id or client to avoid duplicate counts')
    raise ValueError('A finished video needs a client identity')


def save_atomic(path, data):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix=path.name + '.', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def git_sync(path, count):
    """Commit only the ledger; push its branch, never unrelated staged work."""
    git_directory = path.parent
    def git(*args):
        return subprocess.run(['git', '-C', str(git_directory), *args], check=True,
                              capture_output=True, text=True, timeout=60).stdout.strip()
    try:
        root = Path(git('rev-parse', '--show-toplevel'))
        git_directory = root
        relative = str(path.resolve().relative_to(root.resolve()))
        branch = git('symbolic-ref', '--quiet', '--short', 'HEAD')
        changed = git('status', '--porcelain', '--', relative)
        if changed:
            git('add', '--', relative)
            git('commit', '--only', '-m', f'chore(video): count {count} completed local videos', '--', relative)
        upstream = subprocess.run(['git', '-C', str(path.parent), 'rev-parse', '--abbrev-ref',
                                  '--symbolic-full-name', '@{upstream}'], capture_output=True,
                                 text=True, timeout=15)
        if upstream.returncode == 0:
            remote, remote_branch = upstream.stdout.strip().split('/', 1)
            git('push', remote, f'HEAD:refs/heads/{remote_branch}')
        else:
            remotes = git('remote').splitlines()
            if 'origin' not in remotes:
                return {'status': 'pending_push', 'reason': 'No upstream or origin remote configured'}
            git('push', '--set-upstream', 'origin', f'HEAD:refs/heads/{branch}')
        return {'status': 'pushed'}
    except (OSError, ValueError, subprocess.SubprocessError):
        # Do not print Git stderr: remote URLs may contain credentials.
        return {'status': 'pending_sync', 'reason': 'Git commit/push failed; local count is saved. Run video_counter.py sync to retry.'}


def record_finished(output, *, ledger_path=LEDGER, sync=True):
    """Called only after pipeline.render has written all its review evidence."""
    output, path = Path(output).resolve(), Path(ledger_path).resolve()
    report = read(output.with_suffix('.json'))
    edit = report['edit']
    if edit.get('count_video') is False or str(edit.get('idea_id', '')).startswith('smoke-') or any(
            p.startswith('batch-smoke-') for p in output.parts):
        return {'status': 'excluded', 'reason': 'Test or explicitly excluded export'}
    if not output.is_file() or output.stat().st_size == 0:
        raise ValueError('Finished export is missing or empty')
    verification = report.get('verification', {})
    if verification.get('full_decode') is not True or verification.get('audio_master_status') != 'pass':
        raise ValueError('Count requires a decoded export and passing audio master')
    review = read(output.with_suffix('.review.json'))
    audio = read(output.with_suffix('.audio.json'))
    hasher = hashlib.sha256()
    with output.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    if (audio.get('status') != 'pass' or audio.get('output_sha256') != digest
            or review.get('output_sha256') != digest):
        raise ValueError('Render and audio evidence must match the exact finished export')
    if not any(n.get('id') == 'render' and n.get('status') == 'pass'
               for n in review.get('nodes', [])):
        raise ValueError('Count requires completed render review evidence')
    if not edit.get('idea_id'):
        raise ValueError('Finished video needs a stable idea_id; revisions must reuse it')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = read(path)
        client = identity(edit, ledger)
        key = json.dumps([client, str(edit['idea_id'])], ensure_ascii=False)
        added = key not in ledger['videos']
        if added:
            ledger['videos'][key] = {
                'client': client, 'idea_id': str(edit['idea_id']), 'title': edit.get('title', ''),
                'counted_at': datetime.now(timezone.utc).isoformat(),
                'export': output.name, 'stage': 'verified_local_export',
            }
            ledger['count'] = len(ledger['videos'])
            save_atomic(path, ledger)
        result = {'status': 'counted' if added else 'already_counted', 'count': len(ledger['videos'])}
        if sync:
            result['git'] = git_sync(path, result['count'])
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['status', 'record', 'sync'])
    parser.add_argument('output', nargs='?', type=Path)
    args = parser.parse_args()
    if args.command == 'record':
        if args.output is None:
            parser.error('record needs the verified export path')
        result = record_finished(args.output)
    else:
        with LEDGER.with_suffix('.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            ledger = read(LEDGER)
            result = {'count': len(ledger['videos'])}
            if args.command == 'sync':
                result['git'] = git_sync(LEDGER, result['count'])
            else:
                result['by_client'] = {}
                names = {c['key']: c['name'] for c in ledger['clients']}
                for video in ledger['videos'].values():
                    client = names.get(video['client'], video['client'])
                    result['by_client'][client] = result['by_client'].get(client, 0) + 1
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
