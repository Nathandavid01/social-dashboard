#!/usr/bin/env python3
"""Record the generated illustrative assets and their reproducible prompt set."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'media/arecibo/muestra-photo-v5'
GENERATED = Path('/Users/ericperez/.codex/generated_images/01a0a2d9-7e48-7f82-b40b-b0b54583c1fd')
ITEMS = {
    'exercise': ('exec-4d6cdf27-4765-4022-9ee1-78f6caedd23f.png', 'A pair of real premium black rubber hex dumbbells with brushed stainless steel handles, one angled across the other, with natural rubber texture and realistic metallic reflections. Both dumbbells fully visible, no people.'),
    'drinks': ('exec-e8b9e0eb-df36-466d-8990-b3b2e5f0c587.png', 'A real white porcelain espresso coffee cup with dark coffee and a subtle wisp of steam on its saucer, next to a clear tall tumbler of amber-orange fizzy sugary drink with real condensation and ice. Both objects fully visible and naturally arranged, no branded packaging.'),
    'fasting': ('exec-6cf9165d-f5ac-4fb0-a388-a08299f8da8e.png', 'A real clean empty ivory porcelain dinner plate seen at a three-quarter slightly elevated angle, with real brushed stainless steel fork on its left and knife on its right, no food and no napkin. Entire objects fully visible.'),
    'hydrate': ('exec-e8fda5ec-708c-487f-99e1-e355fcf67f5b.png', 'Two real glass vessels separated by generous empty space: on the LEFT a cylindrical crystal-clear glass filled with clean water, natural highlights and fine condensation, on the RIGHT a smaller elegant stemmed wine glass with a small amount of red wine. Both fully visible. Water glass clearly dominant; no bottle. Keep objects separate.'),
}
PROMPT_TEMPLATE = '''Use case: product-mockup. Asset type: photographic object cutout for a professional clinical educational video, not an icon.
Primary request: {subject}
Style: convincing high-end real product photograph with physically accurate shapes, materials, realistic subtle imperfections, soft directional studio light from upper left, discreet cool rim light, neutral color grade.
Composition: landscape 3:2 with subjects grouped horizontally in central 80% of canvas, enough transparent margin all around, camera 70mm lens, objects entirely in focus with subtle natural depth.
Scene/backdrop: TRUE transparent alpha background, isolated object photography.
Deliver a single high-resolution PNG cutout.
NO illustration, cartoon, line art, vector symbols, glossy toy CGI, text, numbers, letters, brands, logo, watermark, labels, prohibition signs, people, hands, furniture or room.
Preserve believable proportions and detailed real photographic texture. The final object group should look photographed and ready to place over a navy video background.'''

def main():
    destination = ASSETS / 'provenance.json'
    if destination.exists():
        raise FileExistsError(destination)
    records = []
    for key, (source_name, subject) in ITEMS.items():
        path = ASSETS / (key + '.png')
        source = GENERATED / source_name
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest == hashlib.sha256(source.read_bytes()).hexdigest()
        with Image.open(path) as image:
            records.append(dict(id=key, path=str(path.relative_to(ROOT)), generated_original=str(source), sha256=digest, width=image.width, height=image.height, mode=image.mode, alpha_extrema=image.getchannel('A').getextrema(), prompt=PROMPT_TEMPLATE.format(subject=subject)))
    payload = dict(created_date='2026-09-19', tool='built-in image_gen', mode='generate', usage='Generated illustrative object cutouts, not footage or photographs of Arecibo Lab.', image_modifications='Source PNGs copied unchanged, preserving alpha and metadata; sized and composited only during video animation.', recipe='edits/arecibo-muestra-0278-v5.json', assets=records)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(destination)

if __name__ == '__main__':
    main()
