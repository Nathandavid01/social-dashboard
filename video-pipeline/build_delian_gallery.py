"""Build a local review page for the five Delian draft videos."""

import html
import json
from pathlib import Path


RUNS = Path(__file__).resolve().parent / "runs"
MANIFEST = RUNS / "delian-five-review.json"
OUTPUT = RUNS / "delian-five.html"


def name_of(value):
    name = Path(value).name
    if name != value or not (RUNS / name).is_file():
        raise ValueError(f"Archivo local no encontrado: {value}")
    return html.escape(name, quote=True)


def build():
    data = json.loads(MANIFEST.read_text())
    cards = []
    for index, item in enumerate(data["videos"], 1):
        video = name_of(item["video"])
        poster = name_of(Path(item["video"]).stem + "-poster.jpg")
        review = name_of(item["review"])
        image = name_of(item["contact_sheet"])
        title = html.escape(item["title"])
        source = html.escape(item["source"])
        status = html.escape(item["source_status"])
        cards.append(
            f'<article id="video-{index}"><div class="eyebrow">Video {index} · {status}</div>'
            f'<h2>{title}</h2><p class="source">{source}</p>'
            + f'<video controls playsinline preload="none" poster="{poster}" src="{video}"></video>'
            + (('<ul class="changes">' + ''.join(f'<li>{html.escape(c)}</li>' for c in item['changes']) + '</ul>') if item.get('changes') else '')
            + f'<div class="links"><a href="{video}" download>Descargar MP4</a>'
            f'<a href="{review}">Informe técnico</a>'
            + (f'<a href="{name_of(item["previous_video"])}">Versión anterior</a>' if item.get('previous_video') else '')
            + '</div>'
            f'<details><summary>Ver fotogramas del montaje</summary><img src="{image}" alt="Fotogramas de {title}"></details>'
            '</article>'
        )
    page = '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Delian Loyola · Cinco videos para revisión</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f8f4f8;color:#28182d;font:16px/1.5 system-ui,-apple-system,sans-serif}main{max-width:1200px;margin:auto;padding:36px 20px 70px}header{margin-bottom:30px}h1{font-size:clamp(32px,4vw,48px);line-height:1.1;margin:6px 0 12px}h2{font-size:24px;line-height:1.2;margin:7px 0 8px}.eyebrow{color:#80346f;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.intro{max-width:820px;color:#614d62}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}article{background:#fff;border:1px solid #e9dfe8;border-radius:18px;padding:22px;box-shadow:0 8px 26px #4a174510}.source{color:#655765;margin:0 0 16px}video{display:block;background:#19121b;border-radius:12px;width:100%;max-height:62vh;aspect-ratio:9/16}.links{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}a{color:#812b76;font-weight:700}ul.changes{margin:14px 0 0;padding-left:20px;color:#3d2a40}ul.changes li{margin:4px 0}details{border-top:1px solid #eee0eb;padding-top:12px}summary{cursor:pointer;color:#56324f;font-weight:650}details img{display:block;width:100%;margin-top:12px;border-radius:8px}footer{margin-top:30px;color:#655765;font-size:14px}@media(max-width:700px){.grid{grid-template-columns:1fr}main{padding:24px 15px 50px}article{padding:16px}}</style>
<main><header><div class="eyebrow">DML Cosmetic Dentistry · Revisión local</div><h1>Cinco videos de Delian</h1><p class="intro">Reedición «más profesionales» (23 septiembre): encuadres y ritmo del estilo publicado, placas de título, subtítulos más grandes y cortes limpios en silencios reales. Voz original, música CC0 y cierre oficial. El apoyo visual aparece solo donde ilustra la explicación. Revisa la fidelidad del texto y la mezcla por oído antes de aprobarlos.</p></header><section class="grid">'''
    page += "".join(cards)
    page += '''</section><footer>Estado: borradores locales. Aprobación del cliente y publicación pendientes. Shoika no está disponible como archivo; la tipografía del lote es Montserrat Bold provisional. Producido con AI — verificar manualmente.</footer></main></html>'''
    OUTPUT.write_text(page)
    print(OUTPUT)


if __name__ == "__main__":
    build()
