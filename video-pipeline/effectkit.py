#!/usr/bin/env python3
"""List, preview and apply reusable effects without overwriting edit recipes."""
import argparse,copy,json,wave,array,subprocess
from pathlib import Path
from effects import PRESETS,SOUNDS,VISUALS,validate_event,sound_samples,visual_filter,layer_fade_filter
R=Path(__file__).resolve().parent

def apply_patch(edit,patch):
 if not isinstance(patch,dict) or set(patch)-{'events','broll_fades'}:raise ValueError('Patch admite events y broll_fades')
 result=copy.deepcopy(edit);total=sum(c['out']-c['in'] for c in result['clips'])
 for event in patch.get('events',[]):
  e=validate_event(event,total)
  if e['preset'] in SOUNDS:e.setdefault('kind','preset')
  result.setdefault('sounds' if e['preset'] in SOUNDS else 'effects',[]).append(e)
 for fade in patch.get('broll_fades',[]):
  index=fade.get('index')
  if isinstance(index,bool) or not isinstance(index,int) or not 0<=index<len(result.get('broll',[])):raise ValueError('Índice B-roll inválido')
  if set(fade)-{'index','fade_in','fade_out'}:raise ValueError('Propiedad de fundido desconocida')
  layer=result['broll'][index]
  for key in ('fade_in','fade_out'):
   if key in fade:layer[key]=fade[key]
  layer_fade_filter(layer)
 result.setdefault('review_notes',[]).append('Efectos aplicados con Effect Kit; nueva exportación y revisión requeridas.')
 return result

def main():
 p=argparse.ArgumentParser(description=__doc__);cmd=p.add_subparsers(dest='cmd',required=True)
 cmd.add_parser('list')
 a=cmd.add_parser('apply');a.add_argument('edit',type=Path);a.add_argument('patch',type=Path);a.add_argument('output',type=Path)
 a=cmd.add_parser('sound');a.add_argument('preset',choices=SOUNDS);a.add_argument('output',type=Path);a.add_argument('--duration',type=float);a.add_argument('--gain-db',type=float)
 a=cmd.add_parser('studio');a.add_argument('--source',type=Path,default=R/'media/81d4110f-a7dd-4ad4-8223-5fa407ca8a03.mp4');a.add_argument('--start',type=float,default=2)
 args=p.parse_args()
 if args.cmd=='list':print(json.dumps(PRESETS,ensure_ascii=False,indent=2));return
 if args.cmd=='studio':
  from build_effect_studio import build
  build(args.source,args.start);return
 if args.output.exists():raise ValueError('El archivo ya existe; elige un nombre nuevo')
 args.output.parent.mkdir(parents=True,exist_ok=True)
 if args.cmd=='apply':
  # Recipes use paths relative to their own folder. Keep that resolution stable.
  if args.edit.resolve().parent!=args.output.resolve().parent:raise ValueError('Guardar receta nueva en la misma carpeta de la receta original')
  result=apply_patch(json.loads(args.edit.read_text()),json.loads(args.patch.read_text()));args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2));print(args.output);return
 e={'preset':args.preset,'time':0}
 if args.duration is not None:e['duration']=args.duration
 if args.gain_db is not None:e['gain_db']=args.gain_db
 with wave.open(str(args.output),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(array.array('h',sound_samples(e)).tobytes())
 print(args.output)
if __name__=='__main__':main()
