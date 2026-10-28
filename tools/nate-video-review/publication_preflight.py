#!/usr/bin/env python3
"""Publication preflight: validate scoped evidence, never claim universal non-publication.

The tool does not query any platform. Its report describes what a reviewer actually
checked and is bound to the exact source media and client. Absence of evidence is
not evidence of absence; analysis limited to samples remains limited to samples.
"""
import argparse
import hashlib
import json
import re
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

RESULTS = {'not_found_in_checked_scope', 'duplicate', 'insufficient'}
COMPARISON_RESULTS = {'no_match', 'match', 'uncertain'}
MEDIA = {'visual', 'audio', 'text'}


def source_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _day(value):
    try:
        return date.fromisoformat(value) if isinstance(value, str) else None
    except ValueError:
        return None


def _timestamp(value):
    try:
        t = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else None
        return t if t is not None and t.tzinfo is not None and t.utcoffset() is not None else None
    except ValueError:
        return None


def evaluate(evidence, *, source_hash, client_id, now=None):
    """Return scope-bound outcome and warnings; malformed/partial inputs fail closed.

    Status is checked_scope, duplicate or pending; checked_scope expressly does not
    assert that the source is unpublished elsewhere. A valid evidence document with
    result `insufficient` remains pending, even if it contains some comparisons.
    """
    output = {'status': 'pending', 'result': 'insufficient', 'findings': [],
              'scope_notice': 'La ausencia en las fuentes revisadas no demuestra ausencia en otros canales, periodos ni segmentos no revisados.'}
    errors = output['findings']
    if not isinstance(evidence, dict):
        errors.append('No hay informe de cotejo válido.')
        return output
    if evidence.get('schema_version') != 1:
        errors.append('Versión de esquema ausente o no compatible.')
    if not isinstance(source_hash, str) or not re.fullmatch(r'[0-9a-f]{64}', source_hash):
        errors.append('Hash de la fuente inválido.')
    if evidence.get('source_sha256') != source_hash:
        errors.append('El hash del informe no corresponde a la fuente.')
    if not _text(client_id) or evidence.get('client_id') != client_id:
        errors.append('El cliente del informe no corresponde a la pieza.')
    checked = _timestamp(evidence.get('checked_at'))
    now = now or datetime.now(timezone.utc)
    if checked is None:
        errors.append('Se requiere fecha y hora de cotejo con zona horaria.')
    elif checked > now:
        errors.append('La fecha de cotejo está en el futuro.')
    if not _text(evidence.get('reviewer')):
        errors.append('Falta identificar quién realizó el cotejo.')
    result = evidence.get('result')
    if not isinstance(result, str) or result not in RESULTS:
        errors.append('Resultado inválido o ambiguo.')
    limitations = evidence.get('limitations')
    if not isinstance(limitations, list) or not limitations or not all(_text(x) for x in limitations):
        errors.append('Describir los límites y el alcance no cubierto.')
    sources = evidence.get('sources')
    valid_ids = set()
    source_ranges = {}
    if not isinstance(sources, list) or not sources:
        errors.append('Registrar las plataformas y cuentas consultadas.')
        sources = []
    for item in sources:
        if not isinstance(item, dict):
            errors.append('Fuente malformada.')
            continue
        sid, platform, account = (item.get(k) for k in ('id', 'platform', 'account'))
        start, end = _day(item.get('from_date')), _day(item.get('to_date'))
        if not _text(sid) or sid in valid_ids or not _text(platform) or not _text(account):
            errors.append('Cada fuente requiere ID único, plataforma y cuenta.')
        else:
            valid_ids.add(sid)
        if not start or not end or start > end:
            errors.append('Cada fuente requiere rango de fechas válido.')
        elif checked is not None and end > checked.date():
            errors.append('El rango consultado no puede terminar después del cotejo.')
        if _text(sid) and start and end and start <= end:
            source_ranges[sid] = (start, end)
        if item.get('access') != 'reviewed':
            errors.append('Una fuente no se pudo revisar; cotejo pendiente.')
    if checked is not None and source_ranges and not any(end >= checked.date() - timedelta(days=1) for _, end in source_ranges.values()):
        errors.append('Ninguna fuente cubre fechas recientes al cotejo; actualizar la búsqueda.')
    comparisons = evidence.get('comparisons')
    if not isinstance(comparisons, list) or not comparisons:
        errors.append('Se requieren comparaciones concretas con publicaciones identificadas.')
        comparisons = []
    has_match = False
    for c in comparisons:
        if not isinstance(c, dict):
            errors.append('Comparación malformada.')
            continue
        if not _text(c.get('source_id')) or c.get('source_id') not in valid_ids or not _text(c.get('publication_id')):
            errors.append('Cada comparación debe identificar la fuente y publicación.')
        published = _day(c.get('publication_date'))
        bounds = source_ranges.get(c.get('source_id')) if _text(c.get('source_id')) else None
        if not published or not bounds or not bounds[0] <= published <= bounds[1]:
            errors.append('Cada publicación requiere fecha dentro del rango de su fuente.')
        methods = c.get('methods')
        if not isinstance(methods, list) or not methods or not all(isinstance(m, str) and m in MEDIA for m in methods):
            errors.append('Cada comparación requiere métodos visual, audio o texto.')
        if not _text(c.get('scope')) or not _text(c.get('observation')):
            errors.append('Cada comparación requiere alcance y observación concretos.')
        outcome = c.get('result')
        if not isinstance(outcome, str) or outcome not in COMPARISON_RESULTS:
            errors.append('Cada comparación requiere resultado válido.')
        if outcome == 'match':
            has_match = True
        if outcome == 'uncertain':
            errors.append('Hay una comparación sin resolver.')
    if result == 'not_found_in_checked_scope' and has_match:
        errors.append('El resultado contradice una coincidencia identificada.')
    if result == 'duplicate' and not has_match:
        errors.append('La coincidencia requiere al menos una comparación con match.')
    if errors:
        return output
    output['result'] = result
    if result == 'duplicate':
        output['status'] = 'duplicate'
        output['findings'].append('Se encontró una coincidencia; no usar como contenido nuevo.')
    elif result == 'not_found_in_checked_scope':
        output['status'] = 'checked_scope'
        output['findings'].append('No se encontró coincidencia en el alcance documentado; no prueba ausencia universal.')
    else:
        output['findings'].append('El informe indica que el cotejo sigue incompleto.')
    return output


def check_for_render(evidence, *, source_hash, client_id, now=None, authorized_published_revision=False):
    """Enforce the pre-render check without granting editorial approval.

    `authorized_published_revision` is valid only for a user-requested re-edit of
    that exact published piece. The caller is responsible for that authorization.
    """
    now = now or datetime.now(timezone.utc)
    outcome = evaluate(evidence, source_hash=source_hash, client_id=client_id, now=now)
    if outcome['status'] == 'pending':
        return outcome
    checked = _timestamp(evidence['checked_at'])
    if now - checked > timedelta(hours=24):
        return {'status': 'pending', 'result': 'insufficient',
                'findings': ['Cotejo desactualizado: repetir la búsqueda antes del render.'],
                'scope_notice': outcome['scope_notice']}
    if outcome['status'] == 'duplicate' and authorized_published_revision is not True:
        return outcome
    outcome['render_gate'] = 'proceed'  # not an editorial or publication approval
    return outcome


def first_graph_node(evidence, *, source_hash, client_id, output_hash, now=None):
    """A scoped evidence node; the caller inserts it as the first graph node."""
    outcome = evaluate(evidence, source_hash=source_hash, client_id=client_id, now=now)
    return {'id': 'publication_check', 'required': True, 'source_sha256': source_hash,
            'client_id': client_id, 'output_sha256': output_hash, **outcome}


def load_and_evaluate(report_path, *, source_path, client_id, now=None):
    try:
        source_hash = source_sha256(source_path)
    except (OSError, TypeError) as exc:
        return {'status': 'pending', 'result': 'insufficient', 'findings': [f'No se pudo leer la fuente: {type(exc).__name__}.']}
    try:
        evidence = json.loads(Path(report_path).read_text(encoding='utf-8'))
    except (OSError, TypeError, UnicodeError, json.JSONDecodeError):
        return {'status': 'pending', 'result': 'insufficient', 'findings': ['No hay informe de cotejo legible.'], 'source_sha256': source_hash}
    outcome = evaluate(evidence, source_hash=source_hash, client_id=client_id, now=now)
    outcome['source_sha256'] = source_hash
    return outcome


def main():
    parser = argparse.ArgumentParser(description='Validar el cotejo de publicación ANTES de editar una pieza nueva.')
    parser.add_argument('--source', required=True, type=Path, help='Archivo original que se desea editar')
    parser.add_argument('--client-id', required=True, help='Identificador exacto del cliente')
    parser.add_argument('--evidence', required=True, type=Path, help='Informe JSON del cotejo real')
    parser.add_argument('--published-revision-authorized', action='store_true',
                        help='Solo si el usuario pidió reeditar la publicación coincidente')
    args = parser.parse_args()
    try:
        evidence = json.loads(args.evidence.read_text(encoding='utf-8'))
        actual_hash = source_sha256(args.source)
        result = check_for_render(evidence, source_hash=actual_hash, client_id=args.client_id,
                                  authorized_published_revision=args.published_revision_authorized)
    except (OSError, UnicodeError, json.JSONDecodeError):
        result = {'status': 'pending', 'result': 'insufficient',
                  'findings': ['No se pudo leer la fuente o el informe de cotejo.']}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get('render_gate') == 'proceed' else 2


if __name__ == '__main__':
    raise SystemExit(main())
