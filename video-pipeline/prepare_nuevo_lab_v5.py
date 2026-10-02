"""Professional revision: complete hook, literal action insert and paced services list."""
from functools import lru_cache
import copy
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pipeline import FFMPEG

R = Path(__file__).resolve().parent
W, H, FPS = 1080, 1920, 30
LIST_START, LIST_DURATION = 11.32, 5.38
LIST_OUTPUT = R / 'media/arecibo/nuevo-lab-services-v5.mov'
SAMPLE_OUTPUT = R / 'media/arecibo/nuevo-lab-sample-detail-v5.mp4'
FONT = R / 'media/arecibo/brand/Montserrat-Bold.ttf'


def ease(v):
    v = max(0., min(1., v))
    return v*v*(3-2*v)


@lru_cache(None)
def font(size):
    return ImageFont.truetype(str(FONT), size*2)


def list_frame(t):
    """Transparent typography overlay; no card behind the clinician."""
    entry = ease(t/.25)
    exit_ = 1-ease((t-4.94)/.42)
    opacity = entry*exit_
    # Feathered scrim remains below the face and behind the list/captions.
    gradient = np.zeros((H, W, 4), dtype=np.uint8)
    gradient[:, :, :3] = (4, 20, 29)
    yy = np.arange(H)
    strength = np.clip((yy-880)/450, 0, 1)*np.clip((1720-yy)/250, 0, 1)
    gradient[:, :, 3] = (strength[:, None]*142*opacity).astype(np.uint8)
    result = Image.fromarray(gradient)
    panel = Image.new('RGBA', (1840, 640))
    d = ImageDraw.Draw(panel)
    d.text((0, 4), 'SERVICIOS', font=font(23), fill=(210, 229, 235, round(230*opacity)))
    events = [(0.80, '01', 'PATERNIDAD'), (2.74, '02', 'DOPAJE'), (3.98, '03', 'CULTIVOS')]
    for i, (at, number, name) in enumerate(events):
        reveal = ease((t-at)/.19)
        if reveal <= 0:
            continue
        active = i == len(events)-1 or t < events[i+1][0]
        a = round(255*reveal*exit_)
        y = round((58+i*84+12*(1-reveal))*2)
        d.text((0,y+6), number, font=font(28), fill=(156,230,8,a))
        d.text((122,y), name, font=font(53), fill=((255,255,255,a) if active else (196,215,222,a)))
        if i<2:
            d.line((122,y+134,1570,y+134), fill=(173,209,222,round(48*reveal*exit_)),width=2)
    result.alpha_composite(panel.resize((920,320),Image.Resampling.LANCZOS),(80,985))
    return result


def render_list():
    proc=subprocess.Popen([FFMPEG,'-v','error','-n','-f','rawvideo','-pix_fmt','rgba',
        '-s','1080x1920','-r','30','-i','-','-an','-c:v','qtrle',str(LIST_OUTPUT)],stdin=subprocess.PIPE)
    try:
        for i in range(162):
            frame=list_frame(i/FPS)
            if i==137:frame.save(R/'runs/arecibo-nuevo-services-v5-overlay.png')
            proc.stdin.write(frame.tobytes())
    finally:
        proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError('Services overlay encoding failed')


def main():
    if LIST_OUTPUT.exists() or SAMPLE_OUTPUT.exists():
        raise FileExistsError('Keep numbered media revisions immutable')
    # Reframe directly from the native 1728x3072 original, not the old 540p crop.
    subprocess.run([FFMPEG,'-v','error','-n','-ss','0.95','-i',
        str(R/'media/arecibo/DJI_20260909094109_0285_D.MP4'),'-t','2.9','-an',
        '-vf','crop=864:1536:320:1480,scale=1080:1920:flags=lanczos,fps=30,eq=contrast=1.025:saturation=0.96',
        '-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(SAMPLE_OUTPUT)],check=True)
    render_list()
    e=json.loads((R/'edits/arecibo-nuevo-lab-0281-v4.json').read_text())
    e['previous_version']='../runs/arecibo-nuevo-lab-0281-v4.mp4'
    # Voice stays continuous through the detail shot. Reframe gently on the new clause.
    e['clips']=[
        {'in':0,'out':2.5,'zoom_keyframes':[{'time':0,'zoom':1},{'time':2.5,'zoom':1.025}]},
        {'in':2.5,'out':11.32,'zoom_keyframes':[{'time':0,'zoom':1},{'time':8.82,'zoom':1.025}]},
        {'in':11.32,'out':16.7,'zoom_keyframes':[{'time':0,'zoom':1.055},{'time':5.38,'zoom':1.035}]},
        {'in':16.7,'out':19.9},
    ]
    e['broll']=[
        {'source':'../media/arecibo/nuevo-lab-sample-detail-v5.mp4','in':0,'out':2.866666,'at':3.74,
         'original_source':'media/arecibo/DJI_20260909094109_0285_D.MP4','source_in':.95,'source_out':3.816666,
         'zoom_keyframes':[{'time':0,'zoom':1},{'time':2.866666,'zoom':1.025}],
         'reason':'Detalle real de la toma de muestra sobre la mención exacta. Única acción pertinente del archivo; reutilización entre reels justificada. Recorte desde original, sin monitor ni conversación a cámara; audio de apoyo silenciado.'},
        {'source':'../media/arecibo/nuevo-lab-services-v5.mov','in':0,'out':LIST_DURATION,'at':LIST_START,
         'kind':'brand_graphic','reason':'Lista acumulativa de los tres servicios grabados, con un click por entrada. Tipografía nativa antialias, sin cubrir rostro ni captions.'},
        {'source':'../media/arecibo/nuevo-lab-location-v6.mp4','in':0,'out':3.2,'at':16.7,
         'kind':'brand_graphic','original_source':'media/arecibo/DJI_20260909100140_0296_D.JPG',
         'reason':'Fachada real a todo el ancho con composición editorial, números sincronizados con ubicación y sin anuncio fechado. Se mantiene hasta el outro sin regreso al presentador.'},
    ]
    e['captions']=[c for c in e['captions'] if c['start'] not in (6.64,8.88)]
    e['captions'].append({'start':6.64,'end':10.96,'text':'QUE EL MÉDICO\nLE ENVÍA EN 3 A 6 MESES'})
    e['captions'].sort(key=lambda c:c['start'])
    e['sounds']=[
        {'kind':'preset','preset':'whoosh_soft','time':2.5,'duration':.18,'gain_db':-28},
        {'kind':'preset','preset':'mouse_click','time':3.74,'duration':.09,'gain_db':-22},
        *[{'kind':'preset','preset':'mouse_click','time':t,'duration':.09,'gain_db':-19}
          for t in [12.12,14.06,15.30]],
        {'kind':'preset','preset':'whoosh_soft','time':16.7,'duration':.24,'gain_db':-25},
    ]
    e['review_notes']=[
        'Reedición profesional solicitada: mantener 22.4 s y mejorar la estructura visual, sin volver a la versión corta.',
        'Gancho completo con presentador y fachada; corte a la doctora al empezar su explicación. Se elimina el mostrador vacío del gancho.',
        'Detalle real de toma de muestra a 3.74–6.61 s sobre la frase exacta; fuente 0285 reutilizada de forma explícita porque no hay otra acción literal disponible.',
        'Unir en un mismo caption que el médico le envía en 3 a 6 meses, evitando que el tiempo parezca una promesa aislada de resultados.',
        'Lista de servicios acumulativa, keyframes discretos y clicks por servicio. Cierre fotográfico editorial sin recuadro gigante ni anuncio fechado.',
        'Se mantienen voz normalizada por toma, música CC0 y outro oficial ya sonorizado. No se duplican efectos en el outro.',
        'Revisión visual y reproducción se documentan en el grafo. La escucha crítica y la aprobación final se mantienen pendientes hasta verificarse.',
    ]
    dest=R/'edits/arecibo-nuevo-lab-0281-v5.json'
    dest.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
    print(dest)


if __name__=='__main__':main()
