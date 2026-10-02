"""Prepare new Yabuuchi revisions with reference-informed swish timing."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = 7
CUES = {
    'primer-sushi': [(146 / 30, -18, 'Entrada al Churrasco Roll')],
    'churrasco-roll': [(318 / 30, -18, 'De ingredientes al enrollado'),
                       (659 / 30, -16, 'Inicio del corte del roll'),
                       (839 / 30, -17, 'Sésamo y presentación final')],
    'la-baby': [(3.8, -18, 'Presentación de la caja'),
                (9.4, -19, 'Regreso a la invitación al local')],
    'quiero-dos': [(8.6, -16, 'Producto después de completar el sketch')],
}

def main():
    manifest = json.loads((ROOT / 'runs/yabuuchi-selection-manifest.json').read_text())
    result = copy.deepcopy(manifest)
    result['package_version'] = VERSION
    result['status'] = 'prepared_pending_render'
    result.pop('playback_verification', None)
    result['effects_revision'] = {
        'request': 'Mejorar efectos y sonidos para hacer el swoosh de la referencia',
        'reference_audit': 'runs/yabuuchi-swoosh-reference-qa/reference-audit.json',
        'sound': 'whoosh_sweep: síntesis original, ataque rápido y cola breve',
        'visual': 'whip_pan: barrido lateral con bordes reflejados, captions estables',
        'total_cues': sum(len(c) for c in CUES.values()),
        'sound_duration': .32,
        'sound_peak_lead': .05,
        'listening': 'pending; no se afirma identidad auditiva',
    }
    for item in result['items']:
        previous = item['recipe']
        edit = json.loads((ROOT / previous).read_text())
        name = f'yabuuchi-seleccion-{item["slug"]}-v{VERSION}'
        destination = ROOT / 'edits' / (name + '.json')
        if destination.exists():
            raise FileExistsError(destination)
        edit['sounds'] = []
        edit['effects'] = []
        events = []
        for cut, level, reason in CUES[item['slug']]:
            edit['sounds'].append({'preset': 'whoosh_sweep', 'time': round(cut - .114, 6),
                                   'duration': .32, 'gain_db': level, 'reason': reason})
            edit['effects'].append({'preset': 'whip_pan', 'time': round(cut - .1, 6),
                                    'duration': .2, 'intensity': .65, 'reason': reason})
            events.append({'cut': round(cut, 6), 'reason': reason, 'gain_db': level})
        edit['effects_reference'] = result['effects_revision']
        edit.setdefault('review_notes', []).append(
            f'V{VERSION}: swooshes de ataque rápido con barrido de imagen, sincronizados al fotograma del corte. '
            'Se conservan duración, escenas completas, captions 72 y cierre de piano. Escucha crítica pendiente.')
        destination.write_text(json.dumps(edit, ensure_ascii=False, indent=2) + '\n')
        item['previous_recipe'] = previous
        item['recipe'] = str(destination.relative_to(ROOT))
        item['file'] = name + '.mp4'
        item['swoosh_cues'] = events
        item['changes'] = edit['review_notes']
        item['summary'] += ' Barridos y swooshes sincronizados con los cambios principales.'
        item.pop('download', None)
    (ROOT / f'runs/yabuuchi-swoosh-selection-v{VERSION}.pending.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'Cuatro recetas v{VERSION} preparadas; galería vigente conservada hasta terminar los renders.')

if __name__ == '__main__':
    main()
