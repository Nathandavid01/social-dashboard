import importlib.util,importlib.machinery,sys,runpy,json,hashlib,types,shutil
from pathlib import Path
root=Path('$WORKSPACE/output/reference-edit-20260926')
p=root/'pipeline'
loader=importlib.machinery.SourcelessFileLoader('effects',str(p/'__pycache__/effects.cpython-312.pyc'))
spec=importlib.util.spec_from_loader('effects',loader)
m=importlib.util.module_from_spec(spec);loader.exec_module(m);sys.modules['effects']=m
font=p/'styles/Arial-local.ttf';shutil.copyfile('/System/Library/Fonts/Supplemental/Arial.ttf',font)
style=json.loads((p/'styles/reference-v2.json').read_text());style['font_file']=font.name
(p/'styles/reference-v3.json').write_text(json.dumps(style,indent=2))
e=json.loads((p/'edits/v3.json').read_text());e['style']='../styles/reference-v3.json';(p/'edits/v3.json').write_text(json.dumps(e,ensure_ascii=False,indent=2))
def build(output):
 output=Path(output);r=json.loads(output.with_suffix('.json').read_text())
 caps=r['captions'];v=next(x for x in r['output']['streams'] if x['codec_type']=='video')
 report={'output':output.name,'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'status':'editorial_review_required','verification':r['verification'],'dimensions':[v['width'],v['height']],'caption_overlap':any(a['end']>b['start'] for a,b in zip(caps,caps[1:])),'last_caption_end':caps[-1]['end'],'outro_duration':3.2,'notes':r['edit']['editorial_notes'],'visual_review':'pending','user_review':'pending'}
 output.with_suffix('.review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));return report
review=types.ModuleType('review_loop');review.build=build;sys.modules['review_loop']=review
sys.argv=[str(p/'pipeline.py'),'render',str(p/'edits/v3.json'),str(root/'Restauco-Lambo-VW-v3.mp4')]
runpy.run_path(str(p/'pipeline.py'),run_name='__main__')
