"""Author five new, versioned September revisions from corrected source words."""
import copy, hashlib, importlib.util, json, re, subprocess, sys, unicodedata
from pathlib import Path

R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R))
from pipeline import cut_words
from editkit import next_free_path
from scripts.snap_words_to_silence import silences, snap

OUT=R/'runs/delian-sept-polish'
MAN=json.loads((R/'runs/delian-sept-five.json').read_text())

def norm(t):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD',t.lower()).encode('ascii','ignore').decode())

def captions(words, clips, phrases):
    mapped=cut_words(words,clips); result=[];cursor=0
    for phrase in phrases:
        target=norm(phrase); combined=''; start=cursor
        while cursor<len(mapped) and len(combined)<len(target):
            combined+=norm(mapped[cursor]['word']);cursor+=1
        if combined!=target:
            raise ValueError(f'Caption mismatch {phrase!r}: {combined!r}, at {start}')
        result.append({'start':round(mapped[start]['start'],3),'end':round(mapped[cursor-1]['end'],3),'text':phrase})
    if cursor!=len(mapped):raise ValueError('Uncaptioned words: '+str(mapped[cursor:]))
    duration=sum(c['out']-c['in'] for c in clips)
    for i,c in enumerate(result):
        stop=result[i+1]['start']-.025 if i+1<len(result) else duration
        c['end']=round(min(stop,max(c['end']+.08,c['start']+.35)),3)
    return result

def clip(a,b,z=1,ky=1.025,focus=.35):
    c={'in':a,'out':b,'zoom':z,'focus_y':focus,'audio_edge_fade':.012}
    if ky>1:c['zoom_keyframes']=[{'time':0,'zoom':1},{'time':round(b-a,6),'zoom':ky}]
    return c

def timeline(s,clips):
    offset=0
    for c in clips:
        if s<=c['out']:return round(offset+max(0,s-c['in']),3)
        offset+=c['out']-c['in']
    return round(offset,3)

PHRASES={
 'diseno-sonrisa': ['¿Qué realmente es','un diseño de sonrisa?','Cuando pensamos en','un diseño de sonrisa,','pensamos rápidamente en','hacernos los dientes,','en carillas, en laminados,','y va mucho más','que eso.','Tenemos que mirar','todo el rostro,','los labios, las encías,','sobre todo la mordida,','para entonces poder crear','una sonrisa armoniosa.'],
 'proceso-sonrisa':['¿Y cómo lo hacemos','aquí en la clínica?','Lo primero es','una evaluación.','Segundo, podemos hacer','un mock-up,','que es básicamente','un encerado de los dientes.','Vamos a hacer','los dientitos como queremos','que el paciente luzca.','Si el paciente le gusta,','entonces el laboratorio','nos hace un caso final.'],
 'hilo-correcto':['Vamos a hablar','un poquito de cómo','pasarnos el hilo dental.','Lo primero es la cantidad','que vamos a necesitar','del hilo dental.','Básicamente va a ser','el largo de tu brazo.','Vamos a cogerlo','con el corazón','y lo vamos a enrollar','hasta que tengamos','básicamente esto de espacio.','Bien poquito.','Y ahí vamos a bajar','y vamos a llegar','por debajo de la encía','a ambos lados','y a este lado también.','Lo que queremos es','abrazar el diente.','Limpiamos bien, removemos,','el sucio lo guardamos','y liberamos nuevo.','Y volvemos otra vez','y bajamos a ambos lados,','abrazamos','y así es que funciona.'],
 'blanqueamiento-antes':['Oye, doctora,','blanqueamiento dental,','¿antes o después','del diseño de sonrisa?','Antes. Bien importante.','¿Por qué?','Porque tenemos que coger','el color de los dientes','y así macharlo','con el diseño de sonrisa.'],
 'ultima-limpieza':['¿Y tú te acuerdas','cuándo fue tu última','limpieza dental?','¿No te acuerdas?','¿Uno, dos años?','Yo creo que es','tiempo de visitarnos.','Se puede comunicar al','787-230-7573']
}
RANGES={
 'diseno-sonrisa':[clip(2.48,4.4,1,1),clip(4.4,10.8,1.24,1.025),clip(10.8,17.8,1.10,1.04),clip(17.8,20.38,1.40,1.02)],
 'proceso-sonrisa':[clip(.25,3.62,1.03,1.025),clip(4.00,8.3,1.16,1.02),clip(8.6,11.90,1.04,1.025),clip(11.90,15.72,1.15,1.02)],
 'hilo-correcto':[clip(1.12,11.7,1,1.012),clip(11.7,19.3,1,1),clip(19.3,28.9,1,1),clip(29.55,34.30,1,1),clip(34.60,40.78,1,1)],
 'blanqueamiento-antes':[clip(2.72,6.53,1,1),clip(6.78,13.7,1.18,1.045)],
 'ultima-limpieza':[clip(1.64,4.25,1,1.02),clip(5.08,8.08,1.12,1.02),clip(8.35,13.72,1.05,1.03)]
}
MUSIC={'diseno-sonrisa':('Lovely Piano Song',5),'proceso-sonrisa':('Inspiration',18),'hilo-correcto':('Be Chillin',4),'blanqueamiento-antes':('Compy Jazz',5),'ultima-limpieza':('Backbeat',12)}

def plate(name,a,b,clips,width=620):
    return {'source':'../media/delian/graphics/sept-polish/'+name+'.png','start':timeline(a,clips),'end':timeline(b,clips),'x':(1080-width)//2,'y':145,'width':width,'enter':.12,'kind':'brand_graphic','reason':'Etapa literal de la explicación; no cubre manos ni captions.'}

results=[]
for item in MAN['videos']:
    old=R/'edits'/Path(item['video']).with_suffix('.json')
    e=json.loads(old.read_text());slug=e['idea_id'].removesuffix('-20260921')
    tr=json.loads((OUT/'transcripts'/(e['idea_id']+'.json')).read_text()); words=[copy.deepcopy(w) for s in tr['segments'] for w in s['words']]
    gaps=silences(e['source'],-32,.15);adjustments=snap(words,gaps)
    if slug=='hilo-correcto':
        # Context: fingers demonstrate a small gap; the two ASRs split de espacio differently.
        for w in words:
            if w['word'].strip().startswith('despacio'):w['word']=' de espacio,'
            if w['word'].strip().startswith('funcionamos'):w['word']=' funciona.'
        # Ambiguous connective is left out of the displayed caption, without changing speech.
        words=[w for w in words if not (26.7<w['start']<27 and norm(w['word'])=='entonces')]
    if slug=='ultima-limpieza':
        for w in words:
            if norm(w['word'])=='y' and w['start']<2:w['start']=1.70
            if norm(w['word'])=='no' and w['start']<6:w['start']=5.30
            if norm(w['word'])=='yo':w['start']=8.48;w['end']=8.62
        words=[w for w in words if w['start']<10.84]
        words.append({'word':' 787-230-7573','start':10.84,'end':13.42,'probability':1})
    clips=RANGES[slug]; e['clips']=clips
    source_words=OUT/'transcripts'/(e['idea_id']+'-editorial.json')
    source_words.write_text(json.dumps({'segments':[{'words':words}],'source_model':'whisper-large-v3-turbo','silence_adjustments':adjustments,'human_listening':'pending'},ensure_ascii=False,indent=2))
    e['transcript']=str(source_words);e['captions']=captions(words,clips,PHRASES[slug]);e['graphics']=[];e['sounds']=[];e['broll']=[];e['effects']=[]
    def sound(t,preset='mouse_click',gain=-29):
        e['sounds'].append({'preset':preset,'time':timeline(t,clips),'gain_db':gain})
    for c in e['captions']:
        if any(k in c['text'].lower() for k in ['armoniosa','mordida','evaluación','mock-up','antes.','787-','abrazar el diente','hilo dental.']):c['primary_colour']='&H00E560EB'
        if slug=='hilo-correcto' and c['start']>=10.5:c['bottom_margin']=1260
    if slug=='diseno-sonrisa':
        sound(4.4,'whoosh_soft',-33);sound(17.8,'whoosh_soft',-33)
    elif slug=='proceso-sonrisa':
        e['graphics']=[plate('proceso-title',.25,1.82,clips,720),plate('eval',2.12,3.5,clips),plate('mockup',4.15,7.98,clips),plate('final',13.6,15.65,clips)]
        sound(.3,'pop',-31);sound(2.12);sound(4.15);sound(13.6)
    elif slug=='hilo-correcto':
        e['graphics']=[plate('hilo-title',1.2,4.2,clips,720),plate('hilo1',4.44,7.6,clips),plate('hilo2',19.72,24.4,clips),plate('hilo3',29.8,34.15,clips)]
        sound(1.2,'pop',-31)
        for t in [4.44,19.72,29.8]:sound(t)
    elif slug=='blanqueamiento-antes':sound(6.97,'mouse_click',-29)
    elif slug=='ultima-limpieza':
        e['broll']=[{'source':'../runs/delian-sept-polish/visita-clinica-silent.mp4','in':0,'out':1.9,'at':timeline(8.48,clips),'fade_in':.10,'fade_out':.12,'reason':'Visita real al consultorio durante tiempo de visitarnos; sin boca presentando ni diálogo ajeno.','zoom_keyframes':[{'time':0,'zoom':1},{'time':1.9,'zoom':1.02}]}]
        sound(8.48,'whoosh_soft',-32);sound(10.84,'pop',-31)
    # Trim and fade the independent music bed; voice and branded outro remain separate.
    name,offset=MUSIC[slug]; duration=sum(c['out']-c['in'] for c in clips)
    source=R/'media/music'/(name+'.mp3');provenance=json.loads(source.with_suffix('.provenance.json').read_text())
    assert provenance['license']=='CC0 1.0'
    bed=R/'media/delian/music'/('sept-polish-'+slug+'.m4a')
    if not bed.exists():
        subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg','-v','error','-n','-ss',str(offset),'-i',str(source),'-t',str(duration),'-vn','-af',f'afade=t=in:d=0.15,afade=t=out:st={duration-.5}:d=0.5','-c:a','aac','-b:a','192k',str(bed)],check=True)
    e['music']={'source':str(bed),'title':name,'license':provenance['license'],'provenance':str(source.with_suffix('.provenance.json')),'source_offset':offset,'fade_in':.15,'fade_out':.5}
    e['review_notes']=[*e.get('review_notes',[]),'Professional revision: second ASR against original audio; manual semantic caption groups, measured pause cuts, subtle keyframes, restrained synchronized sound accents, faded independent CC0 bed. Critical listening remains pending.']
    dest=next_free_path(old);dest.write_text(json.dumps(e,ensure_ascii=False,indent=2))
    results.append({'edit':str(dest),'video':str(R/'runs'/(dest.stem+'.mp4')),'previous':item['video'],'title':e['title'],'music':e['music'],'duration_body':duration})
    print(dest.name,round(duration,3),flush=True)
(OUT/'render-plan.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
