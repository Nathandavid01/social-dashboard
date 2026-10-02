"""Replace the unrelated drink ending with an actual roll handoff and product shot."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline import FFMPEG, cut_words, write_ass


def main():
    recipe = ROOT / 'edits/yabuuchi-otro-rollo-v8.json'
    if recipe.exists():
        raise FileExistsError(recipe)
    previous = json.loads((ROOT / 'edits/yabuuchi-otro-rollo-v7.json').read_text())
    base = (ROOT / 'edits' / previous['source']).resolve()
    delivery = ROOT / 'media/yabuuchi/source/DJI_20260914123652_0989_D.MP4'
    library = json.loads((ROOT / 'media/yabuuchi/broll-index.json').read_text())
    product = next(x for x in library['items'] if '_0987_' in x['filename'])
    segment = product['segments'][2]
    food = ROOT / segment['clip']['source']
    food_start = round(11.4 - segment['effective_source_in'], 6)
    body = ROOT / 'media/yabuuchi/derived/otro-roll-entrega-v8.mkv'
    lead, delivery_in, delivery_out = 215/30, 22/30, 83/30
    delivery_length = delivery_out-delivery_in
    food_at = lead+delivery_length
    duration = food_at+1.6
    filters = [
        f'[0:v]trim=end={lead},setpts=PTS-STARTPTS,fps=30,setsar=1[v0]',
        f'[0:a]atrim=end={lead},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st={lead-.01}:d=0.01[a0]',
        f'[1:v]trim=start={delivery_in}:end={delivery_out},setpts=PTS-STARTPTS,crop=700:1244:200:670,scale=1080:1920,fps=30,setsar=1[v1]',
        f'[1:a]atrim=start={delivery_in}:end={delivery_out},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.01,afade=t=out:st={delivery_length-.01}:d=0.01[a1]',
        f'[2:v]trim=start={food_start}:end={food_start+1.6},setpts=PTS-STARTPTS,scale=1080:1920,fps=30,setsar=1[v2]',
        'anullsrc=r=48000:cl=stereo,atrim=duration=1.6[a2]',
        '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]',
    ]
    subprocess.run([FFMPEG,'-v','error','-n','-filter_complex_threads','2',
                    '-i',str(base),'-i',str(delivery),'-i',str(food),
                    '-filter_complex',';'.join(filters),'-map','[v]','-map','[a]',
                    '-t',str(duration),'-c:v','libx264','-crf','18','-preset','fast',
                    '-threads','4','-c:a','pcm_s24le',str(body)],check=True)
    old_transcript = json.loads((ROOT / 'edits' / previous['transcript']).resolve().read_text())
    words = cut_words([w for s in old_transcript['segments'] for w in s.get('words',[])], [{'in':0,'out':lead}])
    raw_transcript = json.loads((ROOT / 'runs/yabuuchi-transcripts/DJI_20260914123652_0989_D.json').read_text())
    spoken = cut_words([w for s in raw_transcript['segments'] for w in s.get('words',[])], [{'in':delivery_in,'out':delivery_out}])
    words += [{**w,'start':round(w['start']+lead,6),'end':round(w['end']+lead,6)} for w in spoken]
    transcript = ROOT / 'runs/yabuuchi-otro-roll-entrega-v8-mapped.json'
    transcript.write_text(json.dumps({'segments':[{'words':words}]},ensure_ascii=False,indent=2)+'\n')
    e = previous
    e.update(source='../'+str(body.relative_to(ROOT)),transcript='../'+str(transcript.relative_to(ROOT)),
             clips=[{'in':0,'out':duration,'zoom':1,'audio_edge_fade':.015}],broll=[])
    e['captions'] += [{'start':7.28,'end':7.9,'text':'Por aquí.'},
                      {'start':8.02,'end':8.74,'text':'Buen provecho.'}]
    e['audio_master']['speech_regions'].append({'start':7.28,'end':8.74,'role':'entrega'})
    e['sounds'] = [s for s in previous['sounds'] if s['time']<7]
    for cut, preset, length, gain, reason in [
        (lead,'whoosh_sweep',.32,-23,'Entrega real de la caja del roll'),
        (food_at,'whoosh_sweep',.32,-23,'Roll visible en su caja abierta'),
        (duration,'whoosh_soft',.2,-22,'Entrada al outro'),
    ]:
        e['sounds'].append({'preset':preset,'time':round(cut-(.114 if preset=='whoosh_sweep' else .2),6),
                            'duration':length,'gain_db':gain,'reason':reason})
    e['source_parts'] = [
        {'source':str(base.relative_to(ROOT)),'in':0,'out':lead,'at':0,'duration':lead,
         'original_source':'media/yabuuchi/source/DJI_20260914131647_0007_D.MP4',
         'purpose':'Diálogo y llegada al mostrador de la edición anterior, excluyendo el plano de bebida'},
        {'source':str(delivery.relative_to(ROOT)),'in':delivery_in,'out':delivery_out,'at':lead,
         'duration':delivery_length,'mute':False,'crop':[200,670,700,1244],
         'purpose':'Plano detalle de manos entregando caja, servilleta y palillos; conserva Por aquí y Buen provecho, sin conteo'},
        {'source':product['source'],'in':11.4,'out':13,'at':food_at,'duration':1.6,'mute':True,
         'derived_source':segment['clip']['source'],'derived_in':food_start,'derived_out':food_start+1.6,
         'purpose':'Roll real visible en caja abierta; tramo no utilizado anteriormente en el lote'},
    ]
    e['inspiration_shots'] = previous['inspiration_shots'][:6]
    e['review_notes'] = [
        'Eric solicita que el remate entregue un roll y no una bebida, para continuar la idea del pedido.',
        'Se elimina por completo el plano 0014 de Ramune. No se reemplaza digitalmente ningún objeto.',
        'Entrega real de 0989 en plano detalle: manos, caja y palillos. Su voz propia se conserva; cuenta inicial excluida.',
        '0989 ya aparece en Churrasco: se reutiliza por ser la entrega de roll pertinente encontrada; el plano final 0987 11.4–13.0 no tenía uso en el lote.',
        'El corte final muestra el roll en su caja, después de completar la acción de entrega.',
        'Caption inicial literal ¿Quieres otro roll? y perfil Anybody 72 con entrada suave conservados.',
        'Sonidos breves en cambios de plano, Audio Kit y cierre de piano. Nueva versión pendiente de revisión del usuario.',
    ]
    music = ROOT / 'media/yabuuchi/otro-roll-entrega-v8-music.wav'
    subprocess.run([FFMPEG,'-v','error','-n','-i',str(ROOT/'media/music/Downtown Boogie.mp3'),
                    '-t',str(duration),'-af',f'loudnorm=I=-29:TP=-9:LRA=7,aresample=48000,afade=t=in:d=0.08,afade=t=out:st={duration-.45}:d=0.45',
                    '-ar','48000',str(music)],check=True)
    e['music']['source']='../'+str(music.relative_to(ROOT))
    recipe.write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
    style_path=ROOT/'styles/yabuuchi-reference-v6.json';style=json.loads(style_path.read_text())
    ass=ROOT/'runs/yabuuchi-otro-roll-v8-qa/captions.ass'
    write_ass(e['captions'],style,ass,(style_path.parent/style['font_file']).resolve())
    assert all(x.count('\\N')<=1 for x in ass.read_text().splitlines() if x.startswith('Dialogue:'))
    print(recipe.name, 'body',duration,flush=True)


if __name__=='__main__':
    main()
