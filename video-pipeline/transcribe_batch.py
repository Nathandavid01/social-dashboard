import json
from local_transcription import transcribe
from pathlib import Path
R=Path(__file__).resolve().parent
for row in json.load(open(R/'runs/pending-inventory.json')):
 dest=R/'runs'/f"{row['id']}-transcript.json"
 if dest.exists():continue
 result=transcribe(row['source'],dest,'small',initial_prompt="Nana's Playhouse, Plaza Monserrate, Hormigueros. Cumpleaños, juegos, snacks.")
 print(row['id'],row['title'],result['text'],flush=True)
