"""Reconcile saved live Drive snapshot, local files and current review galleries. Read-only sources."""
import json,re,os,zipfile,subprocess,html,csv
from pathlib import Path
from collections import defaultdict,Counter
R=Path(__file__).resolve().parents[1]; A=R.parent/'arecibo-lab-video'; OUT=R/'runs'; esc=lambda x:html.escape(str(x))
snap=json.loads((OUT/'arecibo-drive-audit-snapshot.json').read_text()); files=[dict(f,folder=l['folder']) for l in snap['listings'] for f in l['files']]
actual=[f for f in files if f['mime_type'] not in ['application/vnd.google-apps.shortcut','application/vnd.google-apps.folder']]
names={f['title'] for f in actual};loc=defaultdict(list); archives=defaultdict(list)
for root in [A/'media',R/'media/arecibo',Path.home()/'Downloads']:
 for parent,dirs,fs in os.walk(root):
  dirs[:]=[d for d in dirs if d not in ['node_modules','.git','GenAI','GenAI 2']]
  for name in fs:
   if name in names:
    p=Path(parent)/name
    if p.is_file():loc[name].append(p)
for z in (Path.home()/'Downloads').glob('drive-download*.zip'):
 try:
  with zipfile.ZipFile(z) as f:
   for inf in f.infolist():
    if Path(inf.filename).name in names:archives[Path(inf.filename).name].append({'zip':str(z),'member':inf.filename,'size':inf.file_size})
 except zipfile.BadZipFile:pass
annotations=json.loads((A/'catalogo/annotations.json').read_text());rows=[]
for f in actual:
 ps=loc[f['title']];good=[p for p in ps if p.stat().st_size==int(f['size'])]
 rows.append(dict(**f,local_paths=[str(p) for p in ps],size_matched_paths=[str(p) for p in good],archive_matches=archives[f['title']],availability='Local: nombre y tamaño coinciden' if good else 'Solo ZIP: falta extraer/verificar' if archives[f['title']] else 'Falta descargar',identity_note='Tamaño y nombre; Drive no suministró hash. No equivale a comparación criptográfica.'))
groups=defaultdict(list)
for f in rows:groups[Path(f['title']).stem].append(f)
exports=[]
for page in ['arecibo.html','arecibo-servicios.html']:
 s=(OUT/page).read_text()
 for name in re.findall(r'<video[^>]*src="([^"]+)"',s):
  name=name.split('?')[0];p=OUT/name
  report=p.with_suffix('.json');d=json.loads(report.read_text()) if report.exists() else {};ed=d.get('edit',{})
  if not ed and name=='arecibo-desde-cero-v12.mp4':ed={'title':'Servicios','source':'DJI_20260909092343_0277_D.MP4','legacy_recipe':'../arecibo-lab-video/fresh-edit-v18.json (familia histórica, no identidad de montaje probada)'}
  exports.append({'file':name,'exists':p.exists(),'title':ed.get('title',name),'source':ed.get('original_source',ed.get('source','')),'source_segments':ed.get('source_segments',[]),'clips':ed.get('clips',[]),'broll':ed.get('broll',[]),'approval':'Pendiente: no hay aprobación explícita de esta versión en los registros revisados','evidence':str(report) if report.exists() else 'Galería; falta informe de esta exportación','page':page})
family=[]
for stem,fs in sorted(groups.items()):
 clip=stem.split('_')[-2];ann=annotations.get(clip,{})
 primary=next((f for f in fs if f['title'].endswith('.MP4')),fs[0]);uses=[e['file'] for e in exports if stem in e['source'] or stem in json.dumps(e.get('source_segments',[]))]
 support=[e['file'] for e in exports if stem in json.dumps(e['broll'])]
 state='Sin clasificar' if not ann else 'B-roll catalogado' if ann.get('kind')=='broll' else 'Hablado: pendiente de vincular/editar'
 if primary['title'].endswith('.JPG'):state='Foto: pendiente de clasificar'
 if clip=='0117' and not ann:state='En carpeta BRoll; contenido por revisar'
 if uses:state='Editado parcialmente' if clip=='0278' else 'Con edición; aprobación pendiente'
 if clip=='0271':state='Con edición desde proxy; aprobación pendiente'
 meta={}
 if primary['size_matched_paths'] and primary['title'].upper().endswith(('.MP4','.LRF')):
  try:
   result=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',primary['size_matched_paths'][0]],capture_output=True,text=True,timeout=20)
   meta=json.loads(result.stdout) if result.returncode==0 else {'error':result.stderr[:200]}
  except Exception as ex:meta={'error':str(ex)}
 family.append({'clip':clip,'stem':stem,'files':[x['title'] for x in fs],'availability':primary['availability'],'primary':primary['title'],'url':primary['url'],'description':ann.get('description','Contenido sin revisión documentada'),'status':state,'edits':uses,'support_uses':support,'probe':meta,'remaining':'Queda tema preparación antes de muestra (3.48–52.50, con ensayos)' if clip=='0278' else 'Revisar tramo hablado 12.06–19.64 para idea miedo a la aguja' if clip=='0285' else ''})
ideas=json.loads((OUT/'arecibo-catalog.json').read_text())['ideas'];pending=[i for i in ideas if i['id'] in ['arecibo-antes-de-la-muestra','arecibo-nuevo-laboratorio','arecibo-miedo-aguja','arecibo-ubicacion','arecibo-horario'] and not i.get('current_export')]
summary={'drive_entries':len(files),'shortcuts':sum(f['mime_type'].endswith('shortcut') for f in files),'actual_files':len(rows),'families':len(family),'video_families':sum(not f['primary'].endswith('.JPG') for f in family),'photo_families':sum(f['primary'].endswith('.JPG') for f in family),'files_local_matched':sum(bool(f['size_matched_paths']) for f in rows),'missing_local_files':sum(not f['size_matched_paths'] for f in rows),'current_exports':len(exports),'approved_versions_verified':0,'known_pending_ideas':len(pending),'unclassified_families':sum('clasificar' in f['status'] or 'por revisar' in f['status'] for f in family)}
report={'checked_at':snap['checked_at'],'scope':'Drive raíz y subcarpeta BRoll; Downloads, media locales, catálogo y versiones de galería. Sin publicar ni modificar Drive.','limits':['Listado de Drive guardado: no es monitoreo automático.','Accesos directos no contados como originales; destinos no resueltos individualmente.','Nombre y tamaño cotejados, sin hash remoto.','ffprobe verifica cabecera, no decodificación completa ni contenido editorial.','B-roll catalogado no significa aprobado ni agotado.','No existe un registro central de aprobaciones; cero aprobaciones verificadas no demuestra que nadie haya aprobado fuera de este sistema.','No se revisó visualmente todo el material nuevo; queda identificado como pendiente.'],'summary':summary,'files':rows,'recordings':family,'exports':exports,'pending_ideas':pending,'complete':False}
(OUT/'arecibo-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
with (OUT/'arecibo-audit.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['Grabación','Archivo','Disponibilidad','Estado','Descripción','Ediciones','Uso apoyo','Pendiente','Drive'])
 for x in family:w.writerow([x['clip'],x['primary'],x['availability'],x['status'],x['description'],', '.join(x['edits']),', '.join(x['support_uses']),x['remaining'],x['url']])
cards=''.join(f'<div class="metric"><strong>{v}</strong>{esc(k)}</div>' for k,v in [('Grabaciones de video',summary['video_families']),('Fotos',summary['photo_families']),('Ediciones actuales',summary['current_exports']),('Aprobaciones verificadas',0),('Ideas conocidas pendientes',len(pending)),('Familias por clasificar',summary['unclassified_families'])])
trs=''.join('<tr>'+''.join(f'<td>{v}</td>' for v in [esc(x['clip']),f'<a href="{esc(x["url"])}">{esc(x["primary"])}</a>',esc(x['availability']),esc(x['status']),esc(x['description'])+'<br><b>'+esc(x['remaining'])+'</b>',esc(', '.join(x['edits']+x['support_uses']) or 'Sin uso en las versiones actuales')])+'</tr>' for x in family)
eds=''.join(f'<li><a href="{esc(e["file"])}">{esc(e["title"])}</a> — {esc(e["approval"])}'+(' — ARCHIVO AUSENTE' if not e['exists'] else '')+'</li>' for e in exports)
page=f'''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arecibo Lab · Control De Producción</title><style>body{{font:16px/1.5 system-ui;background:#edf3f6;color:#152b37;margin:0}}main{{max-width:1400px;margin:auto;padding:28px}}a{{color:#09668b}}h1{{font-size:36px}}.metrics{{display:flex;flex-wrap:wrap;gap:12px}}.metric{{background:white;padding:18px;border-radius:12px;flex:1;min-width:140px}}strong{{display:block;font-size:32px}}.notice{{background:#fff2cf;padding:18px;border-radius:12px;margin:22px 0}}.scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%;background:white;font-size:14px}}td,th{{padding:12px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}}input{{padding:12px;width:min(90%,500px);margin:16px 0}}small{{color:#526a75}}</style><main><a href="arecibo.html">← Videos Editados</a><h1>Control De Producción · Arecibo Lab</h1><p>Cruce realizado: {esc(snap['checked_at'])}</p><div class="metrics">{cards}</div><div class="notice"><b>El cliente todavía tiene trabajo pendiente.</b> Hay ideas por editar y grabaciones por clasificar. Las exportaciones no tienen aprobación final documentada.</div><p>{len(files)} entradas en Drive: {summary['actual_files']} archivos reales, {summary['shortcuts']} accesos directos y 1 carpeta. MP4 y LRF de la misma grabación se agrupan. {summary['files_local_matched']} archivos coinciden localmente por nombre y tamaño; {summary['missing_local_files']} sin copia local coincidente.</p><h2>Ediciones Actuales</h2><ul>{eds}</ul><h2>Ideas Pendientes Identificadas</h2><ul>{''.join('<li>'+esc(i['title'])+' · '+esc(i['source_clip'])+'</li>' for i in pending)}</ul><p>0272 es una toma alternativa del tema resultados ya editado con 0271; requiere decisión editorial, no una edición duplicada automática.</p><h2>Inventario Por Grabación</h2><input id="q" placeholder="Buscar grabación, tema o estado" aria-label="Buscar inventario"><div class="scroll"><table><thead><tr><th>Toma</th><th>Archivo</th><th>Copia Local</th><th>Estado</th><th>Contenido / Pendiente</th><th>Ediciones Que La Usan</th></tr></thead><tbody>{trs}</tbody></table></div><h2>Alcance Y Limitaciones</h2><ul>{''.join('<li>'+esc(t)+'</li>' for t in report['limits'])}</ul><p><a href="arecibo-audit.csv" download>Descargar CSV</a> · <a href="arecibo-audit.json">Evidencia JSON</a></p><p>Actualizar: refrescar snapshot de Drive y ejecutar scripts/audit_arecibo.py. No se aprueba ningún video automáticamente.</p></main><script>document.querySelector('#q').addEventListener('input',e=>document.querySelectorAll('tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())))</script></html>'''
(OUT/'arecibo-control.html').write_text(page)
print(json.dumps(summary,ensure_ascii=False));print('MISSING',[(f['primary'],f['availability']) for f in family if not f['availability'].startswith('Local')]);print('UNCLASSIFIED',[f['clip'] for f in family if 'clasificar' in f['status'] or 'por revisar' in f['status']])
