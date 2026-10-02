"""Build the persistent local Arecibo edit gallery from its version manifest."""
import json,html
from pathlib import Path
R=Path(__file__).resolve().parent/'runs'
def build():
 data=json.loads((R/'arecibo-gallery.json').read_text());cards=[]
 for e in data['videos']:
  esc=html.escape
  cards.append(f'''<article id="{esc(e['id'])}"><div class="meta">{esc(e['status'])} · {esc(e['version'])}</div><h2>{esc(e['title'])}</h2><video controls playsinline preload="none" src="{esc(e['file'])}"></video><p>{esc(e['description'])}</p><a href="{esc(e['file'])}" download>Descargar MP4</a> · <a href="{esc(e['review'])}">Revisión</a></article>''')
 page='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arecibo Lab · Videos Editados</title><style>*{box-sizing:border-box}body{margin:0;background:#edf3f6;color:#152b37;font:16px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:36px 24px}h1{line-height:1.15;font-size:38px}header{margin-bottom:30px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:white;padding:24px;border-radius:18px;border:1px solid #d5e2e9}h2{font-size:23px;margin:8px 0 20px}video{display:block;width:100%;max-height:65vh;background:#07161e;border-radius:12px}.meta{color:#336477;font-size:13px;font-weight:700}a{color:#116487}footer{margin-top:28px;color:#586e79}@media(max-width:650px){.grid{grid-template-columns:1fr}main{padding:24px 16px}h1{font-size:30px}}</style><main><header><div class="meta">ARECIBO LAB</div><h1>Videos Editados</h1><p>Versiones guardadas y nuevos videos para revisar.</p><p><a href="arecibo-control.html"><b>Control De Producción · Archivos, Pendientes Y Aprobaciones →</b></a></p></header><section class="grid">'''+''.join(cards)+'''</section><footer><a href="arecibo-servicios.html">Servicios</a> · <a href="nanas.html">Nana’s Playhouse</a><p>Archivos locales, sin publicar. Revisión auditiva y aprobación final pendientes para los nuevos borradores.</p></footer></main></html>'''
 (R/'arecibo.html').write_text(page)
if __name__=='__main__':build()
