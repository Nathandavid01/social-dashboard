"""Reusable, deterministic social-video effects. No external sound dependencies."""
import math
import random

SOUNDS = {
 'clock_tick': {'label':'Reloj Tic','duration':.10,'gain_db':-14},
 'clock_tock': {'label':'Reloj Tac','duration':.10,'gain_db':-14},
 'mouse_click': {'label':'Click De Mouse','duration':.09,'gain_db':-12},
 'keyboard': {'label':'Teclado','duration':.42,'gain_db':-18},
 'pop': {'label':'Pop','duration':.13,'gain_db':-16},
 'whoosh_soft': {'label':'Whoosh Suave','duration':.28,'gain_db':-23},
 'swipe': {'label':'Deslizamiento','duration':.18,'gain_db':-21},
 'impact': {'label':'Impacto Suave','duration':.32,'gain_db':-19},
 'ding': {'label':'Campanilla','duration':.6,'gain_db':-19},
 'sparkle': {'label':'Destellos','duration':.85,'gain_db':-23},
 'logo_drop': {'label':'Caída De Logo','duration':1.4,'gain_db':-19},
}
VISUALS = {
 'punch_zoom': {'label':'Zoom De Énfasis','duration':.45,'category':'effect'},
 'soft_zoom': {'label':'Zoom Suave','duration':1.2,'category':'effect'},
 'blur_pass': {'label':'Transición Desenfocada','duration':.24,'category':'transition'},
 'dip_black': {'label':'Fundido A Negro Y Regreso','duration':.3,'category':'transition'},
 'soft_flash': {'label':'Destello Suave','duration':.16,'category':'transition'},
}
PRESETS = {**{k:{**v,'category':'sound'} for k,v in SOUNDS.items()},**VISUALS}

def finite(value, label):
 if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
  raise ValueError(f'{label} debe ser un número finito')
 return value

def validate_event(event, total=None):
 if not isinstance(event,dict) or event.get('preset') not in PRESETS:raise ValueError('Preset desconocido')
 meta=PRESETS[event['preset']]
 t=finite(event.get('time'), 'time');d=finite(event.get('duration',meta['duration']), 'duration')
 if t<0 or not .04<=d<=4:raise ValueError('Tiempo/duración fuera del rango (duración 0.04–4s)')
 if total is not None and t+d>total+.001:raise ValueError('El efecto termina fuera del video')
 strength=finite(event.get('intensity',1),'intensity')
 if not .1<=strength<=1:raise ValueError('Intensidad fuera de 0.1–1')
 if meta['category']=='sound':
  gain=finite(event.get('gain_db',meta['gain_db']),'gain_db')
  if not -45<=gain<=-12:raise ValueError('Ganancia fuera de -45 a -12 dB')
 return {**event,'duration':d,'intensity':strength}

def sound_samples(event,rate=48000):
 e=validate_event(event);kind=e['preset'];n=round(e['duration']*rate);rng=random.Random(741)
 samples=[];last=0
 for i in range(n):
  t=i/rate;u=i/max(1,n-1);noise=rng.uniform(-1,1);hi=(noise-last)*.5;last=noise
  if kind=='mouse_click':
   x=(.7*math.sin(2*math.pi*1900*t)+.3*hi)*math.exp(-180*t)
   if t>=.024:x+=.3*math.sin(2*math.pi*2600*(t-.024))*math.exp(-300*(t-.024))
  elif kind in ('clock_tick','clock_tock'):
   f=2400 if kind=='clock_tick' else 1500
   x=(.65*math.sin(2*math.pi*f*t)+.22*math.sin(2*math.pi*f*.47*t)+.35*hi)*math.exp(-95*t)
  elif kind=='keyboard':
   x=0
   for j in range(max(1,math.ceil(e['duration']/.085))):
    dt=t-j*.085
    if 0<=dt<.065:x+=(.7*hi+.3*math.sin(2*math.pi*(1100+j*170)*dt))*math.exp(-dt*180)
  elif kind=='pop':x=math.sin(2*math.pi*(740*t-1400*t*t))*math.exp(-t*35)
  elif kind in ('whoosh_soft','swipe'):x=(.7*noise+.3*hi)*(math.sin(math.pi*u)**2)
  elif kind=='impact':x=(.85*math.sin(2*math.pi*(110*t-75*t*t))+.15*noise)*math.exp(-t*15)
  elif kind=='ding':x=(math.sin(2*math.pi*1245*t)+.28*math.sin(2*math.pi*2490*t))*math.exp(-t*8)
  elif kind=='sparkle':
   x=0
   for j,f in enumerate([1400,1760,2100,2640]):
    dt=t-e['duration']*j*.15
    if dt>=0:x+=math.sin(2*math.pi*f*dt)*math.exp(-dt*12)
  else:
   landing=e['duration']*.32
   if t<landing:x=noise*(math.sin(math.pi*t/landing)**2)*.45
   else:
    dt=t-landing;x=(math.sin(2*math.pi*(160*dt-60*dt*dt))+.35*math.sin(2*math.pi*1396*dt))*math.exp(-dt*6/max(.5,e['duration']))
  # Remove onset discontinuity and let every requested duration finish cleanly.
  fade=min(1,i/max(1,rate*.0015),(n-1-i)/max(1,rate*.02))
  samples.append(x*max(0,fade))
 peak=max((abs(v) for v in samples),default=1) or 1
 gain=10**(e.get('gain_db',SOUNDS[kind]['gain_db'])/20)*e['intensity']
 return [round(32767*gain*v/peak) for v in samples]

def visual_filter(event):
 e=validate_event(event);k=e['preset'];a=e['time'];d=e['duration'];s=e['intensity'];b=a+d
 if k not in VISUALS:raise ValueError('Se esperaba un efecto visual')
 gate=f'gte(t,{a})*lt(t,{b})';pulse=f'sin(PI*(t-{a})/{d})'
 if k=='blur_pass':return f"gblur=sigma={2+8*s}:enable='{gate}'"
 if k=='dip_black':return f"eq=brightness='if({gate},-{s}*{pulse},0)':eval=frame"
 if k=='soft_flash':return f"eq=brightness='if({gate},{.18*s}*{pulse},0)':eval=frame"
 # zoompan uses output-frame time, and returns to 1 without reframing captions.
 amp=(.09 if k=='punch_zoom' else .045)*s
 progress=f'max(0,min(1,(on/30-{a})/{d}))'
 z=f'1+{amp}*pow(sin(PI*({progress})),2)'
 return f"scale=1620:2880,zoompan=z='{z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30"

def layer_fade_filter(layer):
 """True alpha dissolve between a B-roll layer and the picture underneath."""
 length=layer['out']-layer['in'];parts=[]
 for key in ('fade_in','fade_out'):
  v=finite(layer.get(key,0),key)
  if not 0<=v<=min(1,length/2):raise ValueError('Fundido B-roll fuera del rango: máximo 1s o media toma')
 if layer.get('fade_in') or layer.get('fade_out'):
  parts.append('format=yuva420p')
  if layer.get('fade_in'):parts.append(f"fade=t=in:st=0:d={layer['fade_in']}:alpha=1")
  if layer.get('fade_out'):parts.append(f"fade=t=out:st={length-layer['fade_out']}:d={layer['fade_out']}:alpha=1")
 return ','.join(parts) or 'null'
