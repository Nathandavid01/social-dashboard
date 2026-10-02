#!/usr/bin/env python3
"""Replace flat illustrations with photographic motion graphics; keep v4 edit/audio."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
old = ROOT / 'edits/arecibo-muestra-0278-v4.json'
new = ROOT / 'edits/arecibo-muestra-0278-v5.json'
recipe = json.loads(old.read_text())
recipe['broll'][1].update({
    'source': '../media/arecibo/muestra-tips-graphics-v5.mov',
    'reason': 'Recortes de objetos de apariencia fotográfica generados para ilustrar el diálogo: pesas, café y bebida, plato vacío, agua y copa. No son metraje real del laboratorio.',
    'asset_provenance': '../media/arecibo/muestra-photo-v5/provenance.json',
})
recipe['review_notes'].append('v5: petición de gráficas más reales. Se sustituyen los iconos planos por objetos con texturas y luz fotográfica, movimiento suave y presentación sobria. Voz, música, captions, cortes y outro de v4 se conservan.')
if new.exists():
    raise FileExistsError(new)
new.write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + '\n')
print(new)
