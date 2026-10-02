"""Verify source reservations across the eight current Nana reels."""
import json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent;O=R/'runs'
items=json.load(open(O/'catalog-reedit-items.json'));rows=json.load(open(R/'media/broll-index.json'));by_path={p:x for x in rows for p in x['aliases']}
derived={'media/security-correct-stairs.mp4':'media/4d7d93f7-fdc4-4814-959d-763c84f81252.mp4','media/security-no-food.mp4':'media/c24fefc0-43f4-4c68-a152-079d3611d90c.mp4','media/child-balls-detail.mp4':'media/dc81b7e7-2c2f-479a-bf66-83c9ab306db7.mp4'}
graphics={'practico-brand-intro.mp4','indoor-logo-contact-synced.mp4','indoor-private-event.mp4','parque-location-card.mp4'}
reservations={};reviewed=[]
for s,v,title in items:
 e=json.load(open(R/f'edits/{s}-v{v}.json'))
 for b in e.get('broll',[]):
  if b['source']==e['source'] or b.get('kind')=='brand_graphic' or Path(b['source']).name in graphics:continue
  p=(R/'edits'/b.get('original_source',b['source'])).resolve();rel=str(p.relative_to(R));rel=derived.get(rel,rel);entry=by_path.get(rel)
  key=entry['sha256'] if entry else hashlib.sha256((R/rel).read_bytes()).hexdigest()
  reservations.setdefault(key,{'source':rel,'family':entry['scene_family'] if entry else 'venue wide derivative','videos':[]})['videos'].append({'slug':s,'title':title,'version':v,'at':b['at'],'in':b.get('source_in',b['in']),'out':b.get('source_out',b['out'])})
 reviewed.append({'slug':s,'version':v,'title':title,'protected':s in {'padres','snacks','cumpleanos'}})
conflicts=[x for x in reservations.values() if len(x['videos'])>1]
for s,d in json.load(open(O/'unique-broll-protected.json')).items():
 assert next(v for slug,v,_ in items if slug==s)==d['version']
 assert hashlib.sha256((O/f'nanas-{s}-v{d["version"]}.mp4').read_bytes()).hexdigest()==d['sha256']
report={'scope':'Eight current Nana reels; brand graphics and source-presenter layers excluded. Does not mean different activity in every shot.','reviewed':reviewed,'protected_files_verified_unchanged':True,'source_conflicts':conflicts,'reservations':list(reservations.values()),'visual_review':'sampled frames, including new ranges; no continuous audio listening'}
(O/'nanas-unique-broll-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(R/'styles/nanas-broll-reservations.json').write_text(json.dumps(list(reservations.values()),ensure_ascii=False,indent=2));assert not conflicts,conflicts
print(f'{len(reviewed)} videos checked, {len(reservations)} unique sources, 0 conflicts; 3 protected exports unchanged.')
