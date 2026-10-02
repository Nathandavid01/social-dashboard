#!/usr/bin/env python3
"""Shared external-SSD Motion Array catalog. Register before downloading; verify after."""
import argparse, contextlib, datetime, fcntl, hashlib, html, json, os, shutil, subprocess
from pathlib import Path
ROOT=Path('/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array')
FFPROBE='/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def save(p,data):
 tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2));os.replace(tmp,p)
def build(db):
 cards=[]
 labels={'musica':'Música','efecto':'Efecto','seleccionado':'Seleccionado','descargando':'Descargando','descarga_fallida':'Descarga Pendiente','descargado_verificado':'Disponible · Verificado','aprobado_por_eric':'Aprobado Por Eric','propuesta_local':'En Revisión','descartado_en_esta_escena':'Descartado En Esta Escena','reemplazado':'Reemplazado'}
 for a in db['assets']:
  variants=[]
  for v in a.get('files',[]):
   path=html.escape(v['library_path'],quote=True)
   variants.append(f'<details><summary>{html.escape(v["name"])} · {v["duration_sec"]:.2f} s</summary><button class="listen" data-src="{path}">Escuchar</button><p><a href="{path}" download>Descargar Archivo</a></p></details>')
  uses=' · '.join(f'{u["client"]} · {u["reel"]} · {u["version"]} · {u.get("variant","")} — {labels.get(u["status"],u["status"])}' for u in a.get('uses',[])) or 'Sin uso registrado'
  search=html.escape(' '.join([a['title'],a['kind'],a.get('author',''),' '.join(a.get('tags',[])),uses]),quote=True)
  cards.append(f'<article data-search="{search}"><small>{html.escape(labels.get(a["kind"],a["kind"]))} · {html.escape(labels.get(a["status"],a["status"]))}</small><h2>{html.escape(a["title"])}</h2><p>{html.escape(a.get("author",""))}</p><p>{html.escape(", ".join(a.get("tags",[])))}</p><p>{html.escape(a.get("guidance",""))}</p><p class="muted">{html.escape(uses)}</p><a href="{html.escape(a["url"],quote=True)}" target="_blank" rel="noopener">Procedencia En Motion Array</a>'+''.join(variants)+'</article>')
 page='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Biblioteca Motion Array · Nate Media</title><style>body{margin:0;background:#141416;color:#fafafa;font:16px/1.5 system-ui;padding:32px}main,header{max-width:1200px;margin:auto}h1{margin-bottom:4px}input{padding:15px;width:min(95%,700px);background:#252529;border:1px solid #666;border-radius:10px;color:white;font:inherit}#grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;margin-top:24px}article{padding:22px;background:#222226;border-radius:14px}h2{font-size:21px}small,.muted{color:#b9b9c1}a{color:#ffa79c}audio{width:100%;margin-top:10px}details{margin-top:12px;border-top:1px solid #444;padding-top:9px}summary{cursor:pointer}article[hidden]{display:none}</style><header><h1>Biblioteca Motion Array</h1><p>Música Y Efectos · Nate Media · Disco Externo</p><p>Descargas, archivos verificados y usos. Busca por escena, sonido o cliente. Los usos y descartes corresponden a cada edición.</p><input id="search" placeholder="Buscar: dinero, afirmación, mandona, cocina…" aria-label="Buscar Recursos"><p id="count"></p><a href="catalogo.json">Catálogo Y Licencias</a> · <a href="README.md">Guía De Uso</a></header><audio id="player" controls preload="none" style="position:sticky;top:10px;width:min(100%,700px);display:block;margin:20px auto"></audio><main id="grid">'''+''.join(cards)+'''</main><script>const cards=[...document.querySelectorAll('article')],q=document.querySelector('#search');const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();function filter(){let n=0;for(const c of cards){c.hidden=!norm(c.dataset.search).includes(norm(q.value));if(!c.hidden)n++}document.querySelector('#count').textContent=n+(n===1?' Recurso':' Recursos')}q.oninput=filter;filter();const player=document.querySelector('#player');document.querySelectorAll('.listen').forEach(b=>b.onclick=()=>{player.src=b.dataset.src;player.play()});</script></html>'''
 (ROOT/'index.html').write_text(page)
def main():
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='cmd',required=True)
 s=sub.add_parser('register');s.add_argument('manifest')
 s=sub.add_parser('verify');s.add_argument('id');s.add_argument('sources',nargs='+')
 s=sub.add_parser('use');s.add_argument('id');s.add_argument('record')
 s=sub.add_parser('status');s.add_argument('id');s.add_argument('state',choices=['seleccionado','descargando','descarga_fallida'])
 sub.add_parser('build');args=p.parse_args()
 if not Path('/Volumes/Extreme SSD').is_mount(): raise SystemExit('Conecta el SSD Extreme antes de escribir la biblioteca.')
 ROOT.mkdir(exist_ok=True)
 with (ROOT/'.catalog.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  f=ROOT/'catalogo.json';db=json.loads(f.read_text()) if f.exists() else {'version':1,'provider':'Motion Array','assets':[]}
  if args.cmd=='register':
   a=json.loads(Path(args.manifest).read_text())
   for key in ['id','title','url','kind','license']:assert a.get(key),key
   if '?' in a['url']:raise ValueError('Only public provenance URL; no signed download URLs')
   if not any(x['id']==a['id'] for x in db['assets']):
    a.update(status='seleccionado',registered_at=now(),files=[],uses=[]);db['assets'].append(a)
  elif args.cmd!='build':
   a=next(x for x in db['assets'] if x['id']==args.id)
   if args.cmd=='status':a['status']=args.state
   if args.cmd=='use':
    u=json.loads(Path(args.record).read_text());u.setdefault('recorded_at',now())
    if not any(all(v.get(k)==u.get(k) for k in ['client','reel','version','status','file_sha256']) for v in a['uses']):a['uses'].append(u)
   if args.cmd=='verify':
    for name in args.sources:
     src=Path(name)
     if src.name.startswith('._') or src.suffix.lower() not in ('.wav','.mp3','.m4a','.mp4','.mov'):continue
     sha=digest(src)
     if any(x['sha256']==sha for x in a['files']):continue
     probe=json.loads(subprocess.check_output([FFPROBE,'-v','error','-show_format','-show_streams','-of','json',str(src)]))
     rel=Path('archivos')/sha[:2]/(sha+src.suffix.lower());dst=ROOT/rel;dst.parent.mkdir(exist_ok=True,parents=True)
     if dst.exists():assert digest(dst)==sha
     else:
      tmp=dst.with_suffix(dst.suffix+'.partial');shutil.copyfile(src,tmp);assert digest(tmp)==sha;os.replace(tmp,dst)
     a['files'].append({'name':src.name,'library_path':str(rel),'source_path':str(src),'sha256':sha,'bytes':src.stat().st_size,'duration_sec':float(probe['format']['duration']),'verified_at':now()})
    if a['files']:a['status']='descargado_verificado'
  db['updated_at']=now();save(f,db);build(db)
  with (ROOT/'actividad.jsonl').open('a') as log:log.write(json.dumps({'at':now(),'action':args.cmd,'asset_id':getattr(args,'id',None),'state':getattr(args,'state',None)},ensure_ascii=False)+'\n')
  print(json.dumps({'assets':len(db['assets']),'files':sum(len(x['files']) for x in db['assets']),'catalog':str(f)},ensure_ascii=False))
if __name__=='__main__':main()
