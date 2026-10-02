"""Build a local review page from an actual render report. No external services."""
import html
import json
import os
from pathlib import Path
import sys

output = Path(sys.argv[1]).resolve()
report = json.loads(output.with_suffix('.json').read_text())
root = Path(__file__).resolve().parent
source = (root / 'edits' / report['edit']['source']).resolve()
original = output.parent / 'clima-original.mp4'
if not original.exists():
    os.link(source, original)
title = html.escape(report['edit']['title'])
duration = report['verification']['duration']
video_name = json.dumps(output.name)
music = report['edit'].get('music', {})
credit = '<a href="CREDITO-MUSICA.txt" download>Crédito De Música · Carefree — Kevin MacLeod (CC BY 4.0)</a>' if music.get('title') == 'Carefree' else ''
credit = 'Música: Happy Whistling Ukulele · CC0 · Sin atribución obligatoria'
body = r'''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nana’s Playhouse · Revisión Del Piloto</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f5f8;color:#27212e;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{border-bottom:1px solid #e8e1eb;background:#fff;padding:20px 5vw;display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}.brand{font-weight:800;letter-spacing:-.5px}.brand span{color:#c80086}.pill{font-size:12px;border-radius:20px;background:#f5e7f1;color:#932071;padding:6px 12px}main{max-width:1120px;margin:30px auto;padding:0 24px;display:grid;grid-template-columns:minmax(260px,440px) minmax(0,1fr);gap:48px}.screen{background:#17121b;border-radius:20px;overflow:hidden;box-shadow:0 12px 45px #39283e18}video{width:100%;max-height:74vh;display:block;background:#17121b;aspect-ratio:9/16}.tabs{display:flex;padding:6px;background:#ede8ee;border-radius:12px;margin-bottom:14px;gap:6px}button,a{font:inherit}button{cursor:pointer}.tabs button{border:0;flex:1;background:transparent;padding:10px;border-radius:8px;color:#554b5a}.tabs button.active{background:#fff;color:#a90075;box-shadow:0 1px 6px #0001}h1{font-size:36px;line-height:1.1;letter-spacing:-1.3px;margin:15px 0}h2{font-size:17px;margin-top:28px}.muted{color:#786f7d;font-size:14px}.eyebrow{text-transform:uppercase;letter-spacing:1.6px;font-size:11px;font-weight:700;color:#a90075}.chapters{padding:0;list-style:none}.chapters button{border:0;border-bottom:1px solid #e7dfe9;background:transparent;text-align:left;width:100%;padding:13px 0;display:flex;gap:18px;color:#382e40}.chapters b{color:#a90075;font-size:13px;font-variant-numeric:tabular-nums;min-width:45px}textarea{width:100%;min-height:110px;resize:vertical;border:1px solid #ddd3e1;border-radius:10px;padding:13px;font:inherit;background:white}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.primary,.secondary{display:inline-block;border-radius:10px;padding:11px 16px;text-decoration:none;border:1px solid #d9cedd;font-size:14px}.primary{background:#a90075;color:white;border-color:#a90075}.secondary{background:#fff;color:#49364e}.status{min-height:24px;font-size:13px;color:#836687}footer{max-width:1120px;margin:20px auto 40px;padding:0 24px;color:#857a8b;font-size:12px}@media(max-width:700px){main{grid-template-columns:1fr;gap:26px;max-width:500px;margin-top:20px}h1{font-size:30px}video{max-height:68vh}header{padding:15px 24px}}
</style><header><div class="brand">Nate Media <span>/</span> Nana’s Playhouse</div><div class="pill">Piloto Local · Pendiente De Revisión</div></header>
<main><section aria-label="Video"><div class="tabs"><button class="active" id="edited">Edición</button><button id="original">Original</button></div><div class="screen"><video id="player" controls playsinline preload="metadata" src="VIDEO_FILE"></video></div><p class="muted" id="viewLabel">Edición · 1080 × 1920 · DURATION s</p></section>
<section><div class="eyebrow">Segundo Reel</div><h1>TITLE</h1><p>La voz de Clima explica cómo seguir disfrutando aunque cambie el tiempo. El montaje muestra juegos bajo techo y cierra con la ubicación y el outro oficial.</p><h2>Revisar Por Momentos</h2><ol class="chapters"><li><button data-time="0"><b>00:00</b>Clima En Puerto Rico</button></li><li><button data-time="3.1"><b>00:03</b>Planes Con Tus Peques</button></li><li><button data-time="5.6"><b>00:06</b>Nana’s · Juegos Bajo Techo</button></li><li><button data-time="8.24"><b>00:08</b>Ubicación · Hormigueros</button></li><li><button data-time="10.9"><b>00:11</b>Outro Oficial</button></li></ol><p><a href="review.html">Ver También: Pregunta</a></p>
<h2><label for="notes">Notas De Revisión</label></h2><textarea id="notes" placeholder="Ejemplo: en 00:05, deja el B-roll un segundo más."></textarea><div class="actions"><button class="secondary" id="mark">Añadir Tiempo Actual</button><button class="secondary" id="save">Descargar Notas</button><a class="primary" href="VIDEO_FILE" download>Descargar MP4</a></div><p class="status" id="status" aria-live="polite"></p><p class="muted">Las notas permanecen en este navegador. Descárgalas o pégalas en la conversación para pedir cambios.</p></section></main><footer>Borrador para revisar texto, ritmo y sonido. Material del dashboard y assets oficiales de Drive. No publicado. MUSIC_CREDIT</footer>
<script>
const editedFile=VIDEO_JSON;const p=document.querySelector('#player'),n=document.querySelector('#notes'),status=document.querySelector('#status');const storageKey='nanas-clima-notes';try{n.value=localStorage.getItem(storageKey)||''}catch{}
function mode(original){p.pause();p.src=original?'clima-original.mp4':editedFile;document.querySelector('#original').classList.toggle('active',original);document.querySelector('#edited').classList.toggle('active',!original);document.querySelector('#viewLabel').textContent=original?'Original · 13.35 s':'Edición · 1080 × 1920 · DURATION s'}
document.querySelector('#original').onclick=()=>mode(true);document.querySelector('#edited').onclick=()=>mode(false);
document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{const t=Number(b.dataset.time);if(!p.src.endsWith(editedFile)){mode(false);p.addEventListener('loadedmetadata',()=>{p.currentTime=t;p.play().catch(()=>{})},{once:true})}else{p.currentTime=t;p.play().catch(()=>{})}});
function persist(){try{localStorage.setItem(storageKey,n.value);status.textContent='Notas guardadas en este navegador.'}catch{status.textContent='Usa Descargar Notas para conservarlas.'}}
n.oninput=persist;document.querySelector('#mark').onclick=()=>{const t=p.currentTime;const label=Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');n.value+=(n.value?'\n':'')+label+' — ';persist();n.focus()};document.querySelector('#save').onclick=()=>{const blob=new Blob([JSON.stringify({video:editedFile,notes:n.value},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nanas-clima-notas.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
</script></html>'''
body = body.replace('VIDEO_FILE', html.escape(output.name)).replace('VIDEO_JSON', video_name).replace('DURATION', f'{duration:.2f}').replace('TITLE', title).replace('MUSIC_CREDIT', credit)
import shutil
shutil.copy2(root / 'media/brand/style-reference.png', output.parent / 'brand-example.png')
graph_path = output.with_suffix('.review.json')
graph = json.loads(graph_path.read_text()) if graph_path.exists() else {'nodes':[]}
labels={'idea':'Idea','references':'Referencias','render':'Montaje','technical_check':'Control Técnico','visual_comparison':'Comparación Visual','audio_comparison':'Comparación De Audio','user_review':'Tu Revisión','revise':'Corregir Y Repetir','font_license':'Licencia De Fuente'}
status_labels={'pass':'Comprobado','pending':'Pendiente','fail':'Corregir','conditional':'Si Hay Hallazgos'}
nodes=''.join('<li><strong>'+labels.get(n['id'],n['id'])+'</strong><small>'+status_labels.get(n['status'],n['status'])+'</small></li>' for n in graph['nodes'])
extra='<section class="comparison"><h2>Comparar Con Las Referencias</h2><p>Activa el sonido de un solo video a la vez para comparar voz, música y efectos.</p><div class="reference-grid"><div><h3>Instagram · Referencia</h3><video controls playsinline preload="metadata" src="instagram-reference.mp4"></video></div><div><h3>Clima · Versión Anterior</h3><video controls playsinline preload="metadata" src="nanas-clima-v1.mp4"></video></div><div><h3>Ejemplo De La Carpeta De Marca</h3><a href="brand-example.png"><img src="brand-example.png" alt="Fuente, borde y sombra del ejemplo de marca"></a></div></div><h2>Ciclo De Revisión</h2><ol class="graph">'+nodes+'</ol><p class="loopback">Si hay diferencias que corregir → nueva versión → repetir comparación.</p><p>Idea: '+html.escape(graph.get('idea',{}).get('hook',''))+'</p><p><a href="'+html.escape(graph_path.name)+'">Ver Evidencia De Esta Versión</a></p></section>'
body=body.replace('</main>','</main>'+extra)
body=body.replace('</style>', '.comparison{max-width:1120px;margin:40px auto;padding:0 24px}.reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.reference-grid video{height:390px;max-height:none;border-radius:12px}.reference-grid img{width:100%;border-radius:12px}.graph{display:flex;gap:10px;flex-wrap:wrap;list-style:none;padding:0}.graph li{background:#f2e5ef;border:1px solid #dbc6d7;border-radius:10px;padding:12px;flex:1;min-width:110px}.graph small{display:block;color:#715b6b}.loopback{color:#a90075}@media(max-width:700px){.reference-grid{grid-template-columns:1fr}.reference-grid video{height:360px}.graph li{min-width:120px}} </style>')
body=body.replace('</script>', "document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==v)other.pause()})));</script>")
body=body.replace('nanas-clima-v1.mp4', html.escape(Path(report['edit'].get('previous_version', 'nanas-clima-v1.mp4')).name))
(output.parent / 'clima.html').write_text(body)
print(output.parent / 'clima.html')
