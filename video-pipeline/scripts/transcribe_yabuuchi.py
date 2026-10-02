import sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R))
from local_transcription import transcribe
for p in sorted((R/'media/yabuuchi/source').glob('*.MP4')):
 dest=R/'runs/yabuuchi-transcripts'/f'{p.stem}.json'
 if dest.exists():continue
 result=transcribe(p,dest,'small',initial_prompt='Yabuuchi Sushi. Toa Baja. Sushi, rollos, sushi pizza, poke bowl, nigiri, sashimi, tempura, spicy crab, salmón, atún, camarones, Ramune.')
 print(p.name,result['text'],flush=True)
