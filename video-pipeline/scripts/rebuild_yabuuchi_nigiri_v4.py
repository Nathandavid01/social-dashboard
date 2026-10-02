"""Educational recut: original question and neutral descriptions, illustrated cards."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline import FFMPEG, cut_words, write_ass

QA = ROOT / 'runs/yabuuchi-sashimi-v4-qa'
ASSETS = ROOT / 'media/yabuuchi/graphics/nigiri-sashimi-v4'
SOURCE = ROOT / 'media/yabuuchi/source/DJI_20260914121706_0983_D.MP4'
BODY = ROOT / 'media/yabuuchi/derived/nigiri-sashimi-rebuild-v4.mkv'
RECIPE = ROOT / 'edits/yabuuchi-sashimi-nigiri-v4.json'
IMAGE = ASSETS / 'comparison-illustration.png'
DURATION = 10.6


def run(args, **kwargs):
    subprocess.run([FFMPEG, '-v', 'error', '-n', *args], check=True, **kwargs)


def stamp(t):
    centis = round(t * 100)
    return f'{centis//360000}:{centis//6000%60:02}:{centis//100%60:02}.{centis%100:02}'


def main():
    if RECIPE.exists() or BODY.exists():
        raise FileExistsError('Use a new revision instead of replacing existing work.')
    QA.mkdir(exist_ok=True, parents=True)
    provenance = {
        'asset': str(IMAGE.relative_to(ROOT)), 'kind': 'ai_generated_educational_illustration',
        'tool': 'image_gen built-in', 'not_client_food': True,
        'prompt': 'Transparent photorealistic educational comparison: salmon sashimi slices without rice on the left; authentic salmon nigiri with clearly visible rice on the right. No plates, logos, text, nori, garnish or roll fillings.',
        'on_screen_disclosure': 'Imagen ilustrativa',
        'source_copy': '/Users/ericperez/.codex/generated_images/01a0bfd8-ecd0-7e43-bacc-7c6348d73668/exec-27d031c4-49d1-4595-a480-c161599dee0a.png',
        'fact_sources': ['https://www.maff.go.jp/e/policies/market/k_ryouri/search_menu/1121/index.html',
                         'https://www.japan.travel/en/guide/sushi-in-japan/'],
        'finding': 'Old cutout lonja is garnish, and pieza-arroz is a filled roll; neither illustrates the concepts accurately. Removed from this edit.'
    }
    (ASSETS/'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n')
    font = ROOT/'media/yabuuchi/brand/Anybody-Expanded-Black.ttf'
    (QA/'fonts').mkdir(exist_ok=True)
    import shutil
    shutil.copy2(font, QA/'fonts/brand.ttf')

    # Editorial labels are separate from verbatim spoken captions.
    ass = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Anybody Expanded Black,96,&H00FFFFFF,&H00FFFFFF,&H00202020,&H80000000,0,0,0,0,100,100,0,0,1,0,2,5,60,60,0,1
Style: Small,Arial,38,&H00D0DFD6,&H00FFFFFF,&H00202020,&H80000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    def label(start,end,text,y,size=96,colour=None,small=False,fade=100):
        nonlocal ass
        tags=f'\\pos(540,{y})\\fs{size}\\fad({fade},70)'
        if colour: tags += '\\c&H'+colour+'&'
        ass += f'Dialogue: 0,{stamp(start)},{stamp(end)},{"Small" if small else "Title"},,0,0,0,,{{{tags}}}{text}\n'
    label(.05,2.52,'NIGIRI / SASHIMI',340,66)
    label(2.6,8.3,'YABUUCHI · SUSHI EN UN MINUTO',250,30,small=True)
    label(2.6,4.8,'SASHIMI',430,98,'6D7DF6')
    label(2.6,4.8,'Pescado, sin arroz.',550,44,small=True)
    label(4.8,8.3,'NIGIRI',430,98,'6D7DF6')
    label(4.8,8.3,'Arroz con pescado encima.',550,44,small=True)
    label(2.6,8.3,'Imagen ilustrativa',1370,28,small=True)
    label(8.3,10.6,'La diferencia está\\Nen el arroz.',310,66)
    label(8.3,10.6,'SASHIMI',790,63,'6D7DF6')
    label(8.3,10.6,'Sin arroz',875,39,small=True)
    label(8.3,10.6,'NIGIRI',1250,63,'6D7DF6')
    label(8.3,10.6,'Con arroz',1335,39,small=True)
    label(8.3,10.6,'Imagen ilustrativa',1420,28,small=True)
    label(8.3,10.6,'¿Cuál prefieres?',1580,72)
    (QA/'labels.ass').write_text(ass)

    # One graphic sequence prevents single-frame flashes at adjoining cards.
    filters = [
        '[0:v]trim=start=1.02:end=3.62,setpts=PTS-STARTPTS,fps=30,scale=1102:1958,crop=1080:1920,setsar=1[v0]',
        '[1:v]split=4[g0][g1][g2][g3]',
        '[g0]crop=768:1024:0:0,scale=900:1200,format=rgba,fade=t=in:d=0.12:alpha=1[sashimi]',
        '[g1]crop=768:1024:768:0,scale=900:1200,format=rgba,fade=t=in:d=0.12:alpha=1[nigiri]',
        '[g2]crop=768:1024:0:0,scale=530:706,format=rgba[small0]',
        '[g3]crop=768:1024:768:0,scale=530:706,format=rgba[small1]',
        'color=c=0x102820:s=1080x1920:r=30:d=2.2[c1]',
        'color=c=0x102820:s=1080x1920:r=30:d=3.5[c2]',
        'color=c=0x102820:s=1080x1920:r=30:d=2.3[c3]',
        '[c1][sashimi]overlay=x=90:y=410:shortest=1,trim=duration=2.2,setpts=PTS-STARTPTS[v1]',
        '[c2][nigiri]overlay=x=90:y=410:shortest=1,trim=duration=3.5,setpts=PTS-STARTPTS[v2]',
        '[c3][small0]overlay=x=275:y=205:shortest=1[comp]',
        '[comp][small1]overlay=x=275:y=660:shortest=1,trim=duration=2.3,setpts=PTS-STARTPTS[v3]',
        '[v0][v1][v2][v3]concat=n=4:v=1:a=0,ass=labels.ass:fontsdir=fonts,format=yuv420p[v]',
        '[0:a]asplit=3[aq][as][an]',
        '[aq]atrim=start=1.02:end=3.62,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.008,afade=t=out:st=2.585:d=0.015[a0]',
        '[as]atrim=start=7.08:end=8.10,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.008,afade=t=out:st=1.012:d=0.008,adelay=3000|3000[a1]',
        '[an]atrim=start=9.18:end=11.50,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.008,afade=t=out:st=2.305:d=0.015,adelay=5120|5120[a2]',
        f'anullsrc=r=48000:cl=stereo,atrim=duration={DURATION}[silence]',
        '[silence][a0][a1][a2]amix=inputs=4:duration=first:normalize=0[a]'
    ]
    (QA/'assembly-filter.txt').write_text(';\n'.join(filters))
    run(['-filter_complex_threads','2','-i',str(SOURCE),'-loop','1','-framerate','30','-i',str(IMAGE),
         '-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-t',str(DURATION),
         '-c:v','libx264','-crf','18','-preset','fast','-threads','4','-c:a','pcm_s24le',str(BODY)],cwd=QA)

    raw=json.loads((ROOT/'runs/yabuuchi-transcripts/DJI_20260914121706_0983_D.json').read_text())
    raw_words=[w for s in raw['segments'] for w in s['words']]
    parts=[(1.02,3.62,0,'Pregunta original completa, sin conteo'),
           (7.08,8.10,3.0,'Fragmento literal: es el pescado solito; sin el nombre invertido'),
           (9.18,11.50,5.12,'Fragmento literal: es una bolita de arroz con la proteína por encimita; sin nombre invertido')]
    mapped=[]
    for a,b,at,_ in parts:
        for word in cut_words(raw_words,[{'in':a,'out':b}]):
            mapped.append({**word,'start':round(word['start']+at,5),'end':round(word['end']+at,5)})
    transcript=ROOT/'runs/yabuuchi-sashimi-v4-mapped.json'
    transcript.write_text(json.dumps({'segments':[{'words':mapped}]},ensure_ascii=False,indent=2)+'\n')
    captions=[{'start':.04,'end':1.16,'text':'Chef, ¿cuál es la diferencia'},
              {'start':1.16,'end':2.4,'text':'entre nigiri y sashimi?'},
              {'start':3.0,'end':4.22,'text':'Es el pescado solito.'},
              {'start':5.12,'end':6.18,'text':'Es una bolita de arroz'},
              {'start':6.18,'end':7.43,'text':'con la proteína por encimita.'}]
    edit=json.loads((ROOT/'edits/yabuuchi-sashimi-nigiri-v3.json').read_text())
    edit.update(source='../'+str(BODY.relative_to(ROOT)),transcript='../'+str(transcript.relative_to(ROOT)),
                clips=[{'in':0,'out':DURATION,'zoom':1,'audio_edge_fade':.01}],captions=captions,broll=[],graphics=[],effects=[],
                audio_master={'mode':'dialogue','voice_mode':'auto','target_lufs':-20,'speech_regions':[
                    {'start':.04,'end':2.4,'role':'pregunta'},
                    {'start':3.0,'end':4.02,'role':'descripcion-sashimi'},
                    {'start':5.12,'end':7.44,'role':'descripcion-nigiri'}]},
                source_parts=[{'source':str(SOURCE.relative_to(ROOT)),'in':a,'out':b,'at':at,'purpose':why,'use':'voice_and_question' if at==0 else 'voice_only'} for a,b,at,why in parts],
                idea_page=1,visual_assets=[provenance])
    edit['sounds']=[{'preset':'whoosh_sweep','time':round(t-.114,3),'duration':.32,'gain_db':-24,'reason':r}
                    for t,r in [(2.6,'Pregunta a comparación ilustrativa de sashimi'),(4.8,'Cambio a nigiri'),(8.3,'Comparación final')]]
    edit['sounds'].append({'preset':'whoosh_soft','time':10.4,'duration':.2,'gain_db':-24,'reason':'Entrada del outro'})
    music=ROOT/'media/yabuuchi/sashimi-nigiri-music-v4.wav'
    run(['-i',str(ROOT/'media/music/Be Chillin.mp3'),'-t',str(DURATION),'-af',
         'loudnorm=I=-29:TP=-9:LRA=7,aresample=48000,afade=t=in:d=0.08,afade=t=out:st=10.15:d=0.45','-ar','48000',str(music)])
    edit['music']['source']='../'+str(music.relative_to(ROOT))
    edit['review_notes']=[
        'Reedición completa solicitada para el antiguo video 11, ahora número 10 tras separar el demo.',
        'PDF p.1: Oye Chef, cuál es la diferencia entre sashimi y nigiri.',
        'La toma invierte los nombres. Se retiran las dos atribuciones erróneas; no se sustituyen palabras ni se genera una voz nueva.',
        'Se conserva pregunta completa y dos descripciones literales neutras, cubiertas por tarjetas editoriales con etiquetas correctas.',
        'Imágenes explicativas generadas con IA y marcadas Imagen ilustrativa; no son B-roll ni platos fotografiados de Yabuuchi.',
        'Los recortes anteriores representaban un aderezo y un roll relleno; se retiran. No se identificó B-roll real confirmado de nigiri y sashimi en el índice local.',
        'Anybody Expanded Black 72, entrada suave, cuatro transiciones sonorizadas, Audio Kit y outro de piano.',
        'Escucha crítica de empalmes y aprobación del usuario pendientes.'
    ]
    RECIPE.write_text(json.dumps(edit,ensure_ascii=False,indent=2)+'\n')
    style_path=ROOT/'styles/yabuuchi-reference-v6.json'
    style=json.loads(style_path.read_text())
    write_ass(captions,style,QA/'captions.ass',(style_path.parent/style['font_file']).resolve())
    assert all(line.count('\\N')<=1 for line in (QA/'captions.ass').read_text().splitlines() if line.startswith('Dialogue:'))
    print(RECIPE,flush=True)


if __name__=='__main__': main()
