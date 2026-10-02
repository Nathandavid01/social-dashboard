"""Build the reusable Nana B-roll catalog; search it without reopening videos."""
from pathlib import Path
import json,hashlib,html,argparse,os
R=Path(__file__).resolve().parent;O=R/'runs/broll-catalog'
def build():
 inventory=json.load(open(O/'inventory.json'));annotations=json.load(open(O/'annotations.json'))
 aliases={}
 for p in (R/'media').glob('*.mp4'):
  if p.stem.startswith('assembled'):continue
  h=hashlib.sha256(p.read_bytes()).hexdigest();aliases.setdefault(h,[]).append(str(p.relative_to(R)))
 current=[x['video'] for x in json.load(open(R/'runs/nanas-batch-manifest.json'))]+['nanas-pregunta-v8.mp4','nanas-clima-v6.mp4','nanas-tour-v2.mp4']
 used={}
 for name in current:
  f=R/'runs'/Path(name).with_suffix('.json')
  if not f.exists():continue
  d=json.load(open(f));e=d['edit']
  for b in e.get('broll',[]):
   if b['source']==e['source'] or b.get('kind')=='brand_graphic':continue
   source='media/'+Path(b.get('original_source',b['source'])).name
   if source=='media/child-balls-detail.mp4':source='media/dc81b7e7-2c2f-479a-bf66-83c9ab306db7.mp4'
   if source=='media/security-no-food.mp4':source='media/c24fefc0-43f4-4c68-a152-079d3611d90c.mp4'
   if source=='media/security-correct-stairs.mp4':source='media/4d7d93f7-fdc4-4814-959d-763c84f81252.mp4'
   used.setdefault(source,[]).append({'video':name,'at':b['at'],'in':b.get('source_in',b['in']),'out':b.get('source_out',b['out'])})
 rows=[]
 for x in inventory:
  n=str(x['number']);a=annotations.get(n,{})
  preview=O/f'{x["number"]:02}.mp4'
  if not preview.exists():os.link(R/x['source'],preview)
  x.update(a);x['scene_family']=a.get('scene_family', (a.get('tags') or ['unclassified'])[0]);x['aliases']=aliases.get(x['sha256'],[x['source']]);x['uses']=[u for p in x['aliases'] for u in used.get(p,[])]
  x['used_in_count']=len(set(u['video'] for u in x['uses']));x['review_status']='sampled_visual_review' if a else 'pending';x['audio']='Not audited; mute source audio for B-roll';x['ranges_status']='Suggested from timestamped samples; check exact cut and mouth movement before render'
  rows.append(x)
 for x in rows:
  x['scene_family_usage']=len(set(u['video'] for y in rows if y['scene_family']==x['scene_family'] for u in y['uses']))
 (R/'media/broll-index.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 lines=['# Biblioteca B-roll de Nana’s','',f'{len(rows)} archivos locales de 35 en la idea Broll. Revisión visual por fotogramas; rangos sugeridos, no escucha continua.','', '## Selección','', 'Primero pertinencia con el diálogo; después priorizar tomas y familias de escenas menos usadas. Revisar el tramo exacto antes del render. No forzar todos los clips en un video.','']
 cards=[]
 for x in rows:
  desc=x.get('description','Pendiente de clasificar');ranges='; '.join(f'{a:g}–{b:g}s: {t}' for a,b,t in x.get('ranges',[]));caution=x.get('caution','')
  lines.extend([f'## {x["number"]:02} · {desc}',f'- Archivo: `{x["source"]}`',f'- Duración: {x["duration"]:.2f}s · Reels actuales: {x["used_in_count"]}',f'- Tramos: {ranges}',f'- Precaución: {caution or "Verificar corte exacto; silenciar audio original."}',f'- Alias idénticos: {", ".join(x["aliases"])}',''])
  cards.append(f'<article data-search="{html.escape(desc+" "+" ".join(x.get("tags",[])),quote=True)}"><h2>{x["number"]:02} · {html.escape(desc)}</h2><p>{x["duration"]:.1f}s · Usado en {x["used_in_count"]} reels actuales</p><img loading="lazy" src="{x["number"]:02}.jpg" alt="Fotogramas con segundos"><p>{html.escape(ranges)}</p><p>{html.escape(caution)}</p><details><summary>Ver Clip, Archivo Y Usos</summary><video controls playsinline preload="none" style="max-width:320px;width:100%" src="{x["number"]:02}.mp4"></video><code>{x["source"]}</code><p>{html.escape(", ".join(sorted(set(u["video"] for u in x["uses"]))) or "Sin uso en los 11 reels actuales")}</p></details></article>')
 (R/'media/BROLL-NANAS.md').write_text('\n'.join(lines))
 (O/'index.html').write_text('''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nana’s · Biblioteca B-roll</title><style>body{font:16px/1.5 system-ui;background:#fff8fc;color:#302334;max-width:1100px;margin:auto;padding:24px}h1{font-size:36px}input{padding:15px;width:100%;box-sizing:border-box;font-size:17px;border:1px solid #bd77a4;border-radius:10px}article{background:white;border:1px solid #ead6e4;padding:20px;border-radius:16px;margin:22px 0}h2{font-size:21px}img{width:100%;height:auto}code{overflow-wrap:anywhere}summary{cursor:pointer}p{color:#625469}</style><h1>Biblioteca B-roll · Nana’s</h1><p>Fotogramas, tramos sugeridos y uso en los reels actuales. Seleccionar por idea y priorizar escenas menos utilizadas. Revisión por fotogramas. Los rangos requieren revisar el corte exacto; silenciar audio original al editar.</p><input id="q" placeholder="Buscar: juegos, comida, rótulo…" aria-label="Buscar tomas"><main>'''+''.join(cards)+'''</main><script>document.querySelector('#q').oninput=e=>{let q=e.target.value.toLocaleLowerCase();document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.toLocaleLowerCase().includes(q))}</script></html>''')
 print(f'Catalog built: {len(rows)}; visually annotated: {len(annotations)}')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--search');a=p.parse_args()
 if a.search:
  rows=json.load(open(R/'media/broll-index.json'));hits=[x for x in rows if a.search.lower() in (x.get('description','')+' '+' '.join(x.get('tags',[]))).lower()]
  for x in sorted(hits,key=lambda x:(x['used_in_count'],x.get('scene_family_usage',0))):print(json.dumps({k:x.get(k) for k in ['number','source','description','ranges','used_in_count','scene_family','scene_family_usage','caution']},ensure_ascii=False))
 else:build()
