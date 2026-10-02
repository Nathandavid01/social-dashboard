"""Replace rejected illustrative support with new photographic assets and visible keyframes."""
import copy,json,shutil,subprocess,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from pipeline import FFMPEG
from editkit import next_free_path,write_new
base=ROOT/'edits/delian-proceso-sonrisa-20260921-v5.json'
dest=next_free_path(base)
e=copy.deepcopy(json.loads(base.read_text()))
folder=ROOT/'media/delian'/('broll-'+dest.stem)
folder.mkdir(exist_ok=False)
shots=[]
for index,(input_path,name,duration,at,direction) in enumerate(zip(sys.argv[1:3],['encerado-macro','laboratorio-ceramica'],[3.0,2.2],[4.67,12.59],['push','pull'])):
 source=Path(input_path)
 image=folder/(name+source.suffix.lower());shutil.copy2(source,image)
 video=folder/(name+'-keyframes.mp4')
 frames=round(duration*30)
 u=f'min(on/{frames-1},1)';ease=f'(({u})*({u})*(3-2*({u})))'
 zoom=f'1.02+0.13*{ease}' if direction=='push' else f'1.15-0.12*{ease}'
 x=f'(iw-iw/zoom)*(0.42+0.12*{ease})' if direction=='push' else f'(iw-iw/zoom)*(0.58-0.12*{ease})'
 y='(ih-ih/zoom)*0.36'
 vf=f"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='{zoom}':x='{x}':y='{y}':d={frames}:s=1080x1920:fps=30,setsar=1,format=yuv420p"
 subprocess.run([FFMPEG,'-v','error','-n','-i',str(image),'-vf',vf,'-frames:v',str(frames),'-an','-c:v','libx264','-crf','17','-preset','fast',str(video)],check=True)
 provenance={'kind':'generated_editorial_photograph','source_generated_image':str(source),'workspace_image':str(image),'video':str(video),'sha256':hashlib.sha256(image.read_bytes()).hexdigest(),'not_actual_client_case':True,'on_screen_label':None,'label_removed_by':'Explicit request from Eric for this revision','keyframes':{'duration':duration,'zoom':[1.02,1.15] if direction=='push' else [1.15,1.03],'horizontal_pan_fractions':[.42,.54] if direction=='push' else [.58,.46],'easing':'smoothstep'},'timeline':{'start':at,'end':round(at+duration,3)}}
 (folder/(name+'.provenance.json')).write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
 shots.append({'source':str(video),'in':0,'out':duration,'at':at,'fade_in':.10 if index==0 else .08,'fade_out':0,'original_source':str(image),'reason':'Fotografía editorial generada de encerado diagnóstico, con acercamiento y desplazamiento; no caso real del cliente.' if index==0 else 'Fotografía editorial generada de trabajo de laboratorio durante su mención, con retroceso y desplazamiento; no resultado real del cliente.'})
assert len(shots)==2
for c,z,a,b in zip(e['clips'],[1.06,1.20,1.10,1.22],[1,1.065,1,1.055],[1.065,1,1.075,1]):
 c['zoom']=z;c['zoom_keyframes']=[{'time':0,'zoom':a},{'time':round(c['out']-c['in'],6),'zoom':b}]
e['broll']=shots
e['sounds'].append({'preset':'mouse_click','time':12.585,'duration':.06,'gain_db':-20})
e['effects']=[{'preset':'blur_pass','time':t-.05,'duration':.1,'intensity':.2} for t in [4.67,7.67,12.59]]
e['review_notes'].append('Eric rechazó el B-roll anterior, pidió quitar Imagen ilustrativa y añadir keyframes. Sustitución completa por dos fotografías editoriales generadas de encerado y laboratorio, sin texto integrado, animadas con acercamiento/retroceso 12–13% y desplazamiento lateral suave. Keyframes de la doctora aumentados a 5.5–7.5%, alternando entrada/salida y conservando gestos. Procedencia conservada fuera de pantalla; no son casos reales del cliente. Captions Shoika, voz, música alegre y outro de v5 conservados; nuevo click al entrar laboratorio.')
write_new(dest,e)
(folder/'manifest.json').write_text(json.dumps({'edit':str(dest),'assets':[x['source'] for x in shots],'prior_rejected_broll':json.loads(base.read_text())['broll'],'direct_playback':'pending'},ensure_ascii=False,indent=2)+'\n')
print(dest)
