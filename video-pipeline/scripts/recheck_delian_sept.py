"""Second ASR pass against the five original recordings; no editorial approval."""
import json
from pathlib import Path
import torch
import whisper

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'runs/delian-sept-polish/transcripts'
OUT.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(6)
model = whisper.load_model('turbo', device='cpu', download_root='/Volumes/Extreme SSD/Nate Media/models/whisper')
for item in json.loads((ROOT/'runs/delian-sept-five.json').read_text())['videos']:
    edit = json.loads((ROOT/'edits'/Path(item['video']).with_suffix('.json')).read_text())
    dest = OUT/(edit['idea_id']+'.json')
    if dest.exists():
        continue
    source = (ROOT/'edits'/edit['source']).resolve()
    result = model.transcribe(str(source), language='es', word_timestamps=True, fp16=False, temperature=0, beam_size=5)
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(edit['idea_id'], result['text'], flush=True)
