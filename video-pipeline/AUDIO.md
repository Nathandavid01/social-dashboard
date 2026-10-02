# Audio Kit · cierre de audio de los reels

Cada nueva exportación de `pipeline.py render` prepara la voz, equilibra la música y el outro y normaliza la mezcla completa. El archivo final pasa una medición independiente antes de aparecer como exportación válida. Aplica a todos los clientes del pipeline.

## Uso habitual

Continuar editando y renderizar una versión nueva como siempre. Audio Kit corre automáticamente; no hay que acordarse de un segundo comando.

```sh
python3 pipeline.py render edits/cliente-idea-v2.json runs/cliente-idea-v2.mp4
```

Se conservan originales y versiones anteriores. Al lado del MP4 aparecen `.audio.json` (mediciones y procedencia) y `.review.json` (estado de revisión). El informe de audio queda vinculado al SHA-256 del archivo exportado, para evitar aprobar otra versión por accidente. Un fallo de sonoridad, pico o duración impide entregar el MP4 bajo el nombre solicitado; el diagnóstico queda en la carpeta de render.

## Qué hace

1. Reconstruye exactamente los cortes de audio del montaje con salida estéreo a 48 kHz, manteniendo duración y sincronía. Mide y procesa el mismo formato de canales para que una fuente mono no termine más fuerte al exportarla en estéreo.
2. Conserva el filtro de limpieza específico de la receta. Sin filtro previo, aplica un corte conservador de graves a la voz; no añade reducción de ruido, de viento ni puertas agresivas automáticamente.
3. Mide el nivel activo de cada intervención. Usa rangos explícitos si existen; en su ausencia agrupa las palabras transcritas por pausas, puntuación y etiquetas de hablante. Esta agrupación no identifica personas ni separa voces superpuestas.
4. Reduce intervenciones fuertes y eleva moderadamente las débiles. Las rampas se aplican por muestra, de modo que la última respuesta no herede el volumen de la pregunta. No eleva silencios o fragmentos por debajo del umbral de ruido.
5. Aplica compresión suave y control de picos a las voces automáticas. En modo de conservación respeta el balance manual existente.
6. Baja música/outro si están por encima de su relación configurada con la voz. No sube una pista de marca que ya esté más baja. Los efectos permanecen sincronizados y pasan por el control de la mezcla final.
7. Trabaja con audio PCM hasta la mezcla final. Hace una medición y una segunda pasada de normalización; copia la imagen y codifica AAC una sola vez en el render habitual.
8. Vuelve a medir el AAC exportado, comprueba duración y decodifica el archivo completo. Si el códec genera picos nuevos, puede repetir una vez desde el PCM con más margen; nunca encadena compresiones AAC para corregirlo.

## Objetivos y ajustes

La fuente única de valores es `styles/audio-master.json`. La configuración inicial de la casa es **−20 LUFS**, techo **−2 dBTP**, tolerancia **±1 LU**, con ganancia positiva de voz limitada a **6 dB**. Se eligió un nivel moderado por la corrección de volumen de Yabuuchi. No es un requisito oficial de Instagram/TikTok ni una certificación de mezcla profesional.

El método de medición/normalización proviene de [FFmpeg loudnorm](https://ffmpeg.org/ffmpeg-filters.html#loudnorm). La [recomendación EBU R 128](https://tech.ebu.ch/publications/r128) utiliza otro objetivo de programa, −23 LUFS; el objetivo de la casa es configurable.

Las excepciones se guardan en `audio_master` dentro de la receta. Los tiempos son del **montaje final antes del outro**, después de aplicar cortes y reordenaciones:

```json
{
  "audio_master": {
    "mode": "dialogue",
    "voice_mode": "auto",
    "target_lufs": -20,
    "speech_regions": [
      {"start": 0.04, "end": 2.04, "role": "question"},
      {"start": 2.10, "end": 2.80, "role": "answer"}
    ]
  }
}
```

No usar los cambios de caption como intervenciones de voz. En una entrevista con poca pausa, revisar los límites de pregunta/respuesta. `speech_regions: null` utiliza la agrupación de transcripción; una lista vacía no nivela frases y genera aviso.

`voice_mode: "preserve"` conserva el balance manual de las voces y pasa igualmente por el control final. Las recetas con `voice_adjustment` usan este modo por defecto. `mode: "music"` omite la nivelación de voz y el rebalanceo de música; se selecciona por defecto en montajes `caption_mode: "editorial"`. Declarar `mode: "dialogue"` si un montaje editorial sí contiene narración.

## Herramientas independientes

```sh
# Medir sin modificar el video
python3 audiokit.py analyze runs/reel-v2.mp4

# Preparar y comprobar voces de una receta sin renderizar imagen
python3 audiokit.py prepare edits/reel-v2.json runs/reel-audio-check-v2

# Masterizar un export de otro editor, conservando la imagen
python3 audiokit.py normalize runs/reel-v2.mp4 runs/reel-v3.mp4

# Excepción de sonoridad explícita
python3 audiokit.py normalize runs/reel-v2.mp4 runs/reel-v3.mp4 --target-lufs -23
```

Reintento compensado (2026-09-29): con LRA mayor que `lra_lu`, `loudnorm` pasa a modo dinámico y en clips breves puede quedar corto de forma estable (Apiario countdown: −21.05 con objetivo −20, entrase a −15.2 o a −20.0). Si el único hallazgo es la sonoridad, `normalize` hace un segundo intento con el objetivo del filtro corregido por el error medido (máx. ±3 LU, una sola vez; `filter_target_lufs` queda en cada intento). El control sigue midiendo contra `target_lufs`; los fallos de pico siguen bajando el techo como antes.

Eco en una mezcla terminada (Apiario countdown, 2026-09-29): antes de «quitar reverb», medir la correlación de la voz L/R. Si es ≈0 (dos micrófonos distintos: solapa seco + cámara distante), el eco percibido es la voz duplicada; separar voz/música con `.venv-audio/bin/audio-separator` (BS-Roformer-Viperx-1297), quedarse con el canal de voz seco en ambos canales, opcionalmente `UVR-DeEcho-DeReverb.pth`, igualar la sonoridad de la voz a la original y remezclar con la música estéreo intacta; luego Audio Kit y grafo. Comprobar desfase A/V 0 ms y misma transcripción. Ejemplo: `runs/apiario-countdown-outro/dereverb/v4-edit-extra.json`.

La herramienta independiente `normalize` trata la mezcla existente como una sola pista. Para equilibrar personas, música y efectos por separado hay que usar la receta con las fuentes originales. No es una herramienta de separación de voces. Los comandos no sobrescriben exports; la carpeta de `prepare` también debe ser nueva.

## Revisión final

El estado técnico `pass` significa que sonoridad, picos, duración y decodificación cumplieron las comprobaciones. La escucha crítica y la aprobación del usuario siguen pendientes. Revisar con auriculares y altavoz: claridad, siseos, ruido levantado, continuidad entre voces y entrada al logo. Una grabación ya distorsionada no se repara sólo bajándole el volumen.

Los avisos señalan voces demasiado débiles, posibles picos en la fuente, falta de intervenciones y diferencias residuales mayores de 6 dB. No los convierte en aprobación automática. El informe y la revisión nunca equivalen a publicación ni a entrega en Recibo.

Pruebas de señales, regresión de la última respuesta, estéreo, silencio, límites, cortes reordenados, AAC real y copia de imagen: `python3 -m unittest -v test_audiokit`. Suite completa: `python3 -m unittest -v`.
