"""Local review page and downloadable package for the four reviewed exports."""
import html
import json
import os
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / 'runs'
manifest_path = RUNS / 'yabuuchi-selection-manifest.json'
manifest = json.loads(manifest_path.read_text())
items = manifest['items']
version = manifest.get('package_version', 1)
package = RUNS / f'Yabuuchi-4-Videos-v{version}'
package.mkdir(exist_ok=True)
labels = ['01-Tu-Primer-Sushi.mp4', '02-Churrasco-Roll.mp4', '03-La-Baby-Para-Dos.mp4', '04-Quiero-Dos.mp4']
notes = [
    'Recomendación del chef con un primer plano del Churrasco Roll.',
    'Ingredientes sincronizados con la preparación y cierre con el roll terminado.',
    'Presentación breve de La Baby con un recorrido por la caja real.',
    'Toma de producto durante la pregunta y regreso al gesto del remate.'
]
entries = []
for item, label, note in zip(items, labels, notes):
    path = RUNS / item['file']
    note = item.get('summary', note)
    meta = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))
    item['duration'] = float(meta['format']['duration'])
    target = package / label
    if not target.exists():
        os.link(path, target)
    poster = path.with_name(path.stem + '-poster.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.25', '-i', str(path), '-frames:v', '1', '-vf', 'scale=540:960', str(poster)], check=True)
    item['download'] = package.name + '/' + label
    entries.append(f'''<article><div class="media"><video controls playsinline preload="none" poster="{poster.name}" aria-label="{html.escape(item['title'])}"><source src="{item['file']}" type="video/mp4"></video></div><div class="info"><span class="number">{len(entries)+1:02d} · {item['duration']:.1f} s</span><h2>{html.escape(item['title'])}</h2><p>{note}</p><a class="download" href="{item['download']}" download>Descargar Video ↓</a></div></article>''')

playlist = RUNS / 'yabuuchi-seleccion-playlist.txt'
playlist.write_text(''.join("file '" + i['file'].replace("'", "'\\''") + "'\n" for i in items))
compilation = RUNS / f'yabuuchi-4-videos-v{version}.mp4'
if not compilation.exists():
    subprocess.run(['ffmpeg', '-v', 'error', '-n', '-f', 'concat', '-safe', '0', '-i', str(playlist), '-c', 'copy', '-movflags', '+faststart', str(compilation)], check=True)

text = '''YABUUCHI · SELECCIÓN DE CUATRO

Cada video incluye B-roll real, captions blancos en negrita y el cierre de la referencia video 1.2.mp4.
Originales y versiones anteriores conservados.

Verificación visual y técnica por exportación; escucha crítica pendiente. Los sonidos de transición se recrearon y no se afirma identidad de música o efectos con la referencia.
'''
if manifest.get('story_revision'):
    text += '\nREVISIÓN DE IDEAS\nLa Baby: apertura original, producto e invitación al local.\nDecir Que No: pregunta, respuesta, Aquí está, entrega y reacción.\nChurrasco: ingredientes, enrollado, amarillito, corte, salsa, sésamo y entrega.\n\nMÚSICA DEL OUTRO\nElegant Piano Logo, de Universfield. Pixabay Content License.\nhttps://pixabay.com/sound-effects/musical-elegant-piano-logo-153281/\nhttps://pixabay.com/service/license-summary/\n'
if manifest.get('effects_revision'):
    text += '\nEFECTOS Y SONIDOS\nSiete swooshes de ataque rápido y cola breve acompañan barridos de imagen en cambios importantes. Efectos sintetizados localmente: no incluyen voz ni música extraídas de la muestra. Se conserva el sketch completo, los captions grandes y el piano del outro. Similitud auditiva y escucha crítica pendientes.\n'
(package / 'LEEME.txt').write_text(text)
zip_path = RUNS / f'Yabuuchi-4-Videos-v{version}.zip'
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_STORED) as z:
    for label in labels + ['LEEME.txt']:
        z.write(package / label, package.name + '/' + label)

page = '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yabuuchi · Selección De Cuatro</title><style>
:root{color-scheme:light;--ink:#073b30;--cream:#f7f5ef;--lime:#d4ed99}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.45 system-ui,-apple-system,sans-serif}main{max-width:1050px;margin:auto;padding:40px 24px 70px}header{margin-bottom:30px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.17em;font-weight:700}h1{font-size:clamp(30px,5vw,52px);line-height:1.05;margin:12px 0}header p{max-width:660px;color:#48645b}a{color:inherit}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.button{display:inline-block;text-decoration:none;border:1px solid var(--ink);padding:12px 18px;border-radius:8px;font-weight:650}.primary{background:var(--ink);color:white}.note{font-size:13px;background:#e8eddf;border-radius:6px;padding:10px 14px;max-width:700px}#grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:white;border:1px solid #dde1d7;border-radius:13px;overflow:hidden}.media{background:#111;text-align:center}video{display:block;width:100%;aspect-ratio:9/16;max-height:590px;object-fit:contain}.info{padding:20px}.number{font-size:12px;letter-spacing:.08em;color:#728276}h2{font-size:23px;line-height:1.15;margin:9px 0}.info p{color:#56675f;min-height:47px;margin-bottom:20px}.download{font-size:14px;font-weight:650;text-underline-offset:4px}details{margin-top:30px;border-top:1px solid #ccd5c5;padding-top:20px}summary{cursor:pointer;font-weight:650}#continuous{max-width:390px;margin:18px auto}.play{display:block;margin:15px auto;background:var(--ink);color:white;border:0;border-radius:7px;padding:12px 18px;font:inherit;cursor:pointer}#status{text-align:center;font-size:13px;color:#586c62}footer{font-size:13px;color:#728276;margin-top:28px}@media(max-width:620px){main{padding:25px 16px}#grid{grid-template-columns:1fr}video{max-height:70vh}.info p{min-height:0}}
</style><main><header><div class="eyebrow">Yabuuchi Sushi · Toa Baja</div><h1>Cuatro Videos Seleccionados</h1><p>B-roll de producto, captions al estilo de tu referencia y cierre de marca.</p><div class="actions"><a class="button primary" href="Yabuuchi-4-Videos-v1.zip" download>Descargar Los Cuatro ↓</a><a class="button" href="#continuous-section" id="show-all">Ver Los Cuatro Seguidos</a></div><p class="note">Imagen, cortes y archivos revisados. La escucha crítica del audio sigue pendiente.</p></header><section id="grid">''' + ''.join(entries) + '''</section><details id="continuous-section"><summary>Reproducción Continua</summary><video id="continuous" controls playsinline preload="none" src="yabuuchi-4-videos-v1.mp4"></video><button class="play" id="play-all">Reproducir Los Cuatro</button><p id="status">Listo Para Reproducir</p></details><footer>Exportaciones locales · 1080 × 1920 · Referencia: video 1.2.mp4</footer></main><script>
const all=document.getElementById('continuous'),section=document.getElementById('continuous-section'),status=document.getElementById('status');document.getElementById('show-all').onclick=()=>{section.open=true};document.getElementById('play-all').onclick=()=>{all.currentTime=0;all.play()};document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(o=>{if(o!==v)o.pause()})));all.addEventListener('timeupdate',()=>status.textContent=all.ended?'Reproducción Completa':`${all.currentTime.toFixed(1)} / ${Number.isFinite(all.duration)?all.duration.toFixed(1):'—'} s`);all.addEventListener('ended',()=>status.textContent='Reproducción Completa');all.addEventListener('error',()=>status.textContent='Error De Reproducción');</script></html>'''
if manifest.get('caption_revision'):
    page = page.replace('B-roll de producto, captions al estilo de tu referencia y cierre de marca.', 'Captions aumentados para igualar el tamaño de tu muestra. Los cuatro videos incluyen B-roll y cierre de marca.')
    page = page.replace('<section id="grid">', '<p style="margin:0 0 24px"><a href="' + html.escape(manifest['caption_revision']['comparison']) + '" target="_blank">Comparar El Tamaño Con La Muestra ↗</a></p><section id="grid">')
if manifest.get('story_revision'):
    page = page.replace('Captions aumentados para igualar el tamaño de tu muestra. Los cuatro videos incluyen B-roll y cierre de marca.', 'La Baby, Churrasco y Decir Que No ahora incluyen las escenas que faltaban. Captions grandes y nuevo cierre de piano en los cuatro.')
    page = page.replace('Cuatro Videos Seleccionados', 'Cuatro Videos Revisados')
if manifest.get('effects_revision'):
    page = page.replace('La Baby, Churrasco y Decir Que No ahora incluyen las escenas que faltaban. Captions grandes y nuevo cierre de piano en los cuatro.', 'Swooshes de entrada rápida y barridos en los cambios de plano. Ideas completas, captions grandes y cierre de piano.')
    page = page.replace('Cuatro Videos Revisados', 'Barridos Y Sonidos Ajustados')
page = page.replace('<div class="actions">', '<div class="actions"><a class="button" href="yabuuchi-library/index.html">Biblioteca De B-roll →</a>')
(RUNS / 'yabuuchi-cuatro.html').write_text(page.replace('-v1.', f'-v{version}.'))
manifest['status'] = 'exported_pending_review'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print('http://127.0.0.1:3046/yabuuchi-cuatro.html')
