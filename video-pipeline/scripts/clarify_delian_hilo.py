import json
from pathlib import Path
import torch, whisper
R=Path(__file__).resolve().parents[1]
torch.set_num_threads(6)
model=whisper.load_model('turbo',device='cpu',download_root='/Volumes/Extreme SSD/Nate Media/models/whisper')
source=next((R.parent/'delian-loyola-video/media/source-2026-09-21').glob('*165000*.mp4'))
audio=whisper.load_audio(str(source))
results=[]
for a,b in [(16.4,18.98),(26.65,29.05),(38.25,41.3)]:
    d=model.transcribe(audio[round(a*16000):round(b*16000)],language='es',fp16=False,temperature=0,beam_size=5,condition_on_previous_text=False)
    results.append({'source_in':a,'source_out':b,'text':d['text']})
    print(results[-1],flush=True)
(R/'runs/delian-sept-polish/hilo-word-disputes.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
