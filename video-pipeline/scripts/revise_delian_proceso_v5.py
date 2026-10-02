"""Reference-led revision of Proceso De Sonrisa; preserve original speech."""
import copy
import json
import subprocess
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import audiokit
from pipeline import FFMPEG, synth_sounds
from editkit import next_free_path, write_new
base = ROOT/'edits/delian-proceso-sonrisa-20260921-v4.json'
dest = next_free_path(base)
edit = copy.deepcopy(json.loads(base.read_text()))
work = ROOT/'runs'/(dest.stem+'-preparation')
work.mkdir(exist_ok=False)
def ff(*args):
    subprocess.run([FFMPEG,'-v','error','-n',*map(str,args)],check=True)
body = round(sum(c['out']-c['in'] for c in edit['clips']),6)
tail = edit['outro']['out']-edit['outro']['in']
total=body+tail
edit['style']='../styles/delian-reference-v6-shoika.json'
for c,z in zip(edit['clips'],[1.06,1.23,1.10,1.30]):
    c['zoom']=z
    c['focus_y']=.35
for c in edit['captions']:
    c.pop('primary_colour',None)
    if c['end']<=1.6:c['back_colour']='&H00000000'
edit['captions'].append({'start':0,'end':1.62,'text':'Diseño de sonrisa:\npaso a paso','bottom_margin':1550,'back_colour':'&H00000000'})
# End exactly at the next camera cut, avoiding a 0.22-second return to the old shot.
edit['broll'][0].update(at=4.67, **{'in':0,'out':3.0}, fade_in=.10,fade_out=0,
    reason='Ilustración educativa de encerado durante la mención de mock-up/encerado. Rótulo Imagen ilustrativa conservado; no es un caso real ni simulación Invisalign.')
edit['graphics']=[]
clicks=[1.865,3.37,4.67,7.67,10.97]
edit['sounds']=[{'preset':'mouse_click','time':max(0,t-.005),'duration':.06,'gain_db':-20} for t in clicks]
edit['effects']=[{'preset':'blur_pass','time':t-.05,'duration':.1,'intensity':.2} for t in [4.67,7.67]]
edit['audio_master']={'music_below_voice_lu':10}
source=ROOT/'media/music/Funshine.mp3'
prov=json.loads(source.with_suffix('.provenance.json').read_text())
assert prov['license']=='CC0 1.0' and audiokit.digest(source)==prov['sha256']
cfg=audiokit.settings(edit)
voice=json.loads((ROOT/'runs/delian-proceso-sonrisa-20260921-v4.audio.json').read_text())['voice']
raw=work/'funshine-offset24-raw.wav'
ff('-ss',24,'-i',source,'-t',total,'-vn','-af',f'afade=t=in:d=0.08,afade=t=out:st={total-.8}:d=0.8','-ar',48000,'-ac',2,'-c:a','pcm_s24le',raw)
level=audiokit.measure(raw,cfg,prefilter=f'atrim=end={body}')['input_i']
target=voice['measurement']['input_i']-cfg['music_below_voice_lu']-.2
gain=round(target-level,4)
music=work/'funshine-continuous.wav'
ff('-i',raw,'-af',f'volume={gain}dB','-c:a','pcm_s24le',music)
click=work/'outro-click.wav';synth_sounds(click,tail,[{'preset':'mouse_click','time':0,'duration':.06,'gain_db':-20}])
outro=work/'official-outro-funshine-click.mov'
ff('-i',ROOT/'media/delian/brand/outro-loyola.mp4','-i',music,'-i',click,'-filter_complex',f'[1:a]atrim=start={body}:end={total},asetpts=PTS-STARTPTS[bed];[bed][2:a]amix=inputs=2:duration=first:normalize=0[tail]','-map','0:v:0','-map','[tail]','-t',tail,'-c:v','copy','-c:a','pcm_s24le',outro)
edit['outro'].update(source=str(outro),gain=1)
edit['music']={'source':str(music),'title':'Funshine','license':'CC0 1.0','provenance':str(source.with_suffix('.provenance.json')),'source_offset':24,'fade_in':.08,'fade_out':.8,'fade_out_scope':'End of official outro; continuous music through the join'}
edit['review_notes'].append('Aplicar aprendizajes de Diseño de Sonrisa v7: Shoika72 blanca/sombra violeta, pregunta sombra negra, música alegre continua y clicks secos. Se conserva íntegra la voz de v4. Título contextual explícito para que la pregunta inicial se entienda sola; retirar placas repetitivas. Encerado ilustrativo identificado, sin presentar Invisalign como mock-up; apoyo termina en cambio de plano sin retorno fugaz. Escucha crítica y aprobación pendientes.')
edit['references']['caption_comparison']='runs/delian-published-caption-audit/caption-comparison.jpg'
write_new(dest,edit)
audiokit.save(work/'plan.json',{'edit':str(dest),'output':str(ROOT/'runs'/(dest.stem+'.mp4')),'body_seconds':body,'total_seconds':total,'music_gain_db':gain,'music_source_offset':24,'click_times':clicks+[body],'speech_cuts_unchanged_from':'v4','real_mockup_broll_available':False,'broll_choice':'Existing labeled educational wax-up illustration; not a real patient result','critical_listening':'pending'})
print(dest)
