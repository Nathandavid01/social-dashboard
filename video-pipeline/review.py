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
original = output.parent / 'pregunta-original.mp4'
if not original.exists():
    os.link(source, original)
title = html.escape(report['edit']['title'])
duration = report['verification']['duration']
video_name = json.dumps(output.name)
music = report['edit'].get('music', {})
credit = '<a href="CREDITO-MUSICA.txt" download>Crédito De Música · Carefree — Kevin MacLeod (CC BY 4.0)</a>' if music.get('title') == 'Carefree' else ''
body = r'''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nana’s Playhouse · Revisión Del Piloto</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f5f8;color:#27212e;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{border-bottom:1px solid #e8e1eb;background:#fff;padding:20px 5vw;display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}.brand{font-weight:800;letter-spacing:-.5px}.brand span{color:#c80086}.pill{font-size:12px;border-radius:20px;background:#f5e7f1;color:#932071;padding:6px 12px}main{max-width:1120px;margin:30px auto;padding:0 24px;display:grid;grid-template-columns:minmax(260px,440px) minmax(0,1fr);gap:48px}.screen{background:#17121b;border-radius:20px;overflow:hidden;box-shadow:0 12px 45px #39283e18}video{width:100%;max-height:74vh;display:block;background:#17121b;aspect-ratio:9/16}.tabs{display:flex;padding:6px;background:#ede8ee;border-radius:12px;margin-bottom:14px;gap:6px}button,a{font:inherit}button{cursor:pointer}.tabs button{border:0;flex:1;background:transparent;padding:10px;border-radius:8px;color:#554b5a}.tabs button.active{background:#fff;color:#a90075;box-shadow:0 1px 6px #0001}h1{font-size:36px;line-height:1.1;letter-spacing:-1.3px;margin:15px 0}h2{font-size:17px;margin-top:28px}.muted{color:#786f7d;font-size:14px}.eyebrow{text-transform:uppercase;letter-spacing:1.6px;font-size:11px;font-weight:700;color:#a90075}.chapters{padding:0;list-style:none}.chapters button{border:0;border-bottom:1px solid #e7dfe9;background:transparent;text-align:left;width:100%;padding:13px 0;display:flex;gap:18px;color:#382e40}.chapters b{color:#a90075;font-size:13px;font-variant-numeric:tabular-nums;min-width:45px}textarea{width:100%;min-height:110px;resize:vertical;border:1px solid #ddd3e1;border-radius:10px;padding:13px;font:inherit;background:white}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.primary,.secondary{display:inline-block;border-radius:10px;padding:11px 16px;text-decoration:none;border:1px solid #d9cedd;font-size:14px}.primary{background:#a90075;color:white;border-color:#a90075}.secondary{background:#fff;color:#49364e}.status{min-height:24px;font-size:13px;color:#836687}footer{max-width:1120px;margin:20px auto 40px;padding:0 24px;color:#857a8b;font-size:12px}@media(max-width:700px){main{grid-template-columns:1fr;gap:26px;max-width:500px;margin-top:20px}h1{font-size:30px}video{max-height:68vh}header{padding:15px 24px}}
</style><header><div class="brand">Nate Media <span>/</span> Nana’s Playhouse</div><div class="pill">Piloto Local · Pendiente De Revisión</div></header>
<main><section aria-label="Video"><div class="tabs"><button class="active" id="edited">Edición</button><button id="original">Original</button></div><div class="screen"><video id="player" controls playsinline preload="metadata" src="VIDEO_FILE"></video></div><p class="muted" id="viewLabel">Edición · 1080 × 1920 · DURATION s</p></section>
<section><div class="eyebrow">Primera Receta De Edición</div><h1>TITLE</h1><p>La pregunta abre el reel. Los juegos y los snacks aparecen cuando la voz los menciona. El cierre usa el outro oficial de Nana’s.</p><h2>Revisar Por Momentos</h2><ol class="chapters"><li><button data-time="0"><b>00:00</b>Pregunta · Subtítulos</button></li><li><button data-time="2.74"><b>00:03</b>Respuesta · Cambio De Encuadre</button></li><li><button data-time="5.25"><b>00:05</b>Juegos · B-roll Del Trampolín</button></li><li><button data-time="9"><b>00:09</b>Snacks · B-roll De Nachos Y Bebidas</button></li><li><button data-time="12.15"><b>00:12</b>Cierre · Outro Oficial</button></li></ol>
<h2><label for="notes">Notas De Revisión</label></h2><textarea id="notes" placeholder="Ejemplo: en 00:05, deja el B-roll un segundo más."></textarea><div class="actions"><button class="secondary" id="mark">Añadir Tiempo Actual</button><button class="secondary" id="save">Descargar Notas</button><a class="primary" href="VIDEO_FILE" download>Descargar MP4</a></div><p class="status" id="status" aria-live="polite"></p><p class="muted">Las notas permanecen en este navegador. Descárgalas o pégalas en la conversación para pedir cambios.</p></section></main><footer>Borrador para revisar texto, ritmo y sonido. Material del dashboard y assets oficiales de Drive. No publicado. MUSIC_CREDIT</footer>
<script>
const editedFile=VIDEO_JSON;const p=document.querySelector('#player'),n=document.querySelector('#notes'),status=document.querySelector('#status');const storageKey='nanas-pregunta-piloto-notes';try{n.value=localStorage.getItem(storageKey)||''}catch{}
function mode(original){p.pause();p.src=original?'pregunta-original.mp4':editedFile;document.querySelector('#original').classList.toggle('active',original);document.querySelector('#edited').classList.toggle('active',!original);document.querySelector('#viewLabel').textContent=original?'Original · 15.02 s':'Edición · 1080 × 1920 · DURATION s'}
document.querySelector('#original').onclick=()=>mode(true);document.querySelector('#edited').onclick=()=>mode(false);
document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{const t=Number(b.dataset.time);if(!p.src.endsWith(editedFile)){mode(false);p.addEventListener('loadedmetadata',()=>{p.currentTime=t;p.play().catch(()=>{})},{once:true})}else{p.currentTime=t;p.play().catch(()=>{})}});
function persist(){try{localStorage.setItem(storageKey,n.value);status.textContent='Notas guardadas en este navegador.'}catch{status.textContent='Usa Descargar Notas para conservarlas.'}}
n.oninput=persist;document.querySelector('#mark').onclick=()=>{const t=p.currentTime;const label=Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');n.value+=(n.value?'\n':'')+label+' — ';persist();n.focus()};document.querySelector('#save').onclick=()=>{const blob=new Blob([JSON.stringify({video:editedFile,notes:n.value},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nanas-pregunta-notas.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
</script></html>'''
body = body.replace('VIDEO_FILE', html.escape(output.name)).replace('VIDEO_JSON', video_name).replace('DURATION', f'{duration:.2f}').replace('TITLE', title).replace('MUSIC_CREDIT', credit)
(output.parent / 'review.html').write_text(body)
print(output.parent / 'review.html')
