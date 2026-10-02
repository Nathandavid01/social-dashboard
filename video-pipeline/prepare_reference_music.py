"""Recreate the music bed from the supplied reference stereo track."""
from pathlib import Path
import json
import numpy as np
from scipy.io import wavfile
rate,a=wavfile.read('media/reference/music-side.wav');a=a.astype(np.float64)/32768
# Select a steady section, excluding the largest transition transients.
loop=a[round(8.5*rate):round(17.5*rate)]
overlap=round(.35*rate); f=np.linspace(0,1,overlap)
bed=np.concatenate((loop[:-overlap],loop[-overlap:]*(1-f)+loop[:overlap]*f,loop[overlap:]))[:round(12.15*rate)]
rms=np.sqrt(np.mean(bed**2));bed*=10**(-30/20)/max(rms,1e-9)
fade=round(.18*rate);bed[:fade]*=np.linspace(0,1,fade)
fade=round(.5*rate);bed[-fade:]*=np.linspace(1,0,fade)
wavfile.write('media/brand/reference-music-bed.wav',rate,(np.clip(bed,-1,1)*32767).astype(np.int16))
