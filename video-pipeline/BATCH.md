# Edición por lote desde un prompt

El agente interpreta «edita tres videos de Delian», consulta una vez el contexto
vigente y prepara un plan para las tres piezas. El coordinador ejecuta las tareas
locales y guarda el avance. No hace llamadas a modelos remotos.

## Recorrido

**Prompt → contexto del cliente → selección conjunta → preparación local →
plan editorial conjunto → render secuencial → revisión de los tres.**

La elección de cortes, material pertinente y tratamiento creativo sigue siendo
una decisión del agente, con revisión visual. No se generan automáticamente
imágenes, B-roll o música. No se necesita una conversación distinta por video.

## Entrada única

Desde la carpeta video-pipeline (rutas de medios relativas a esa carpeta):

```sh
python3 pipeline.py batch start delian --count 3 --prompt "Edita tres videos de Delian" --folder runs/delian-lote-01
python3 pipeline.py batch select runs/delian-lote-01 selection.json
python3 pipeline.py batch prepare runs/delian-lote-01
python3 pipeline.py batch compose runs/delian-lote-01 decisions.json
python3 pipeline.py batch run runs/delian-lote-01
```

Estos comandos son trabajo del agente, no instrucciones que Eric tenga que
introducir. `select` y `prepare` se pueden ejecutar en una misma intervención;
`compose` y `run` también. Hay dos momentos principales de decisión del agente:
selección con contexto y plan editorial con transcripciones/material. Se agregan
las intervenciones necesarias para revisar visualmente, escuchar y corregir.

La carpeta del lote debe ser nueva, con nombre de letras, números y guiones.
Puede estar en el SSD externo: renders e intermedios quedan en esa carpeta.
Las recetas versionadas se guardan en `edits/` y la caché de transcripciones
pequeña sigue en `runs/.transcription-cache`.

## Selección conjunta

`selection.json` es una lista de N objetos:

```json
[
  {
    "id": "video-1",
    "idea_id": "ID_REAL_DEL_CATALOGO",
    "source": "media/cliente/original.mp4",
    "transcript": "runs/transcripcion-existente.json",
    "publication_check": {
      "checked_at": "FECHA_REAL",
      "result": "RESULTADO_VERIFICADO",
      "evidence": "ENLACE_O_REGISTRO"
    }
  }
]
```

Repetir con las otras piezas. El programa exige N IDs únicos e ideas del catálogo
del cliente; rechaza ideas marcadas `do_not_reedit` o `skip_as_new_reel`.
El agente comprueba qué original corresponde a la idea: un nombre de archivo no
prueba la relación. No confundir una entrega de Recibo con publicación.
`publication_check` conserva evidencia proporcionada; no consulta redes ni verifica
por sí solo su veracidad. Si falta, se muestra `not_verified` en la preparación.

Omitir `transcript` solo si hace falta transcribir; el modelo predeterminado es
`base`. `model` e `initial_prompt` son opcionales. Una transcripción existente se
usa como fuente editorial y se conserva; el agente debe confirmar su correspondencia
con el original. `prepared.json` concentra diálogo y segmentos de las piezas sin
volver a incluir todas las instrucciones.

## Un plan para las piezas

`decisions.json` es una lista de decisiones:

```json
[
  {
    "id": "video-1",
    "clips": [{"in": 1.2, "out": 14.8, "zoom": 1.1}],
    "editorial_note": "Conservar explicación completa y retirar preparación inicial.",
    "broll": [],
    "sounds": [],
    "effects": []
  }
]
```

Los tiempos del ejemplo son ilustrativos: usar los reales y no cortar palabras.
Se admiten además `captions`, `graphics`, `music`, `audio_master` y `caption_mode`,
con el mismo formato de las recetas del pipeline. Las rutas internas de B-roll,
música y gráficas se resuelven desde `edits/`. Perfil, original, transcripción,
catálogo y cliente quedan vinculados al lote y no se aceptan como overrides.
`compose` hereda estilo vigente y outro; genera captions cuando no se suministran.
Las decisiones de revisión son completas, no parches: incluir los apoyos que se
quieran conservar. `compose` valida el lote antes de escribir recetas.

## Retomar y corregir

- `status RUTA`: resumen breve sin abrir el contexto completo.
- `run RUTA`: retoma trabajos pendientes, conserva exports anteriores y comprueba
  huellas del export e identidad de sus entradas. No renderiza un video verificado
  de nuevo. El bloqueo impide dos ejecuciones de lotes simultáneas.
- Un fallo antes de generar el MP4 puede reintentarse. Si existe un export
  incompleto, se conserva y se necesita una nueva revisión con `compose`.
- `compose RUTA correccion.json`: incluir solo los videos afectados; genera nuevas
  recetas y salidas, mantiene historial y no vuelve a renderizar los otros.
- `refresh RUTA`: actualiza el contexto después de cambios en instrucciones o
  catálogos. Revisar el nuevo contexto antes de componer planes actualizados.

Los checkpoints usan identidad de archivo (ruta, volumen, inode, tamaño y tiempos)
para no leer todos los videos cada vez. El MP4 final sí se comprueba por SHA-256,
Audio Kit, decodificación y control técnico. No se borra nada automáticamente.

## Revisión final

Abrir `review.html` desde la carpeta del lote, o servirla localmente con soporte
para reproducción. Los videos usan `preload="none"`. Cada MP4 mantiene sus informes
`.json`, `.audio.json` y `.review.json`. El estado `review_pending` significa que
los controles técnicos pasaron; quedan revisión visual, escucha y aprobación.
El programa no publica, sube a Recibo ni marca aprobación del cliente.

## Validación de esta implementación

- Suite completa: 82 pruebas correctas, incluyendo reanudación, fallo de una pieza,
  revisión de una sola pieza, cambio de instrucciones/fuentes y protección de ideas.
- Prueba local con tres clips sintéticos de 1.8 segundos: tres renders reales con
  Audio Kit, decodificación y controles técnicos. Al retomar, ninguno se renderizó
  de nuevo y las fechas de los tres MP4 permanecieron iguales.
- Evidencia en `runs/batch-smoke-1790471730/`; no son videos de clientes ni una
  prueba de calidad editorial/escucha humana.
- Una prueba inicial detectó captions que excedían el final del montaje; se corrigió
  el generador de captions y se añadió una prueba específica.

Esto valida el coordinador local y la recuperación de trabajo. El ahorro real de
tokens y tiempo por encargo aún debe medirse en un lote editorial de un cliente.

## Si falta el estilo del cliente

`start` busca sus publicaciones en Metricool y entrega `needs_style_reference`
con el reporte y la instrucción para obtener fotogramas de hasta tres videos.
El agente revisa los captions visibles, crea el archivo de estilo y registra sus
referencias; luego repite `start` en la misma carpeta para continuar el lote.
Se conservan las instrucciones explícitas de Eric. No se usa el texto del post
como evidencia visual ni se adopta automáticamente un estilo genérico.
Si falla el acceso o no aparecen referencias utilizables, el resultado lo declara.
La búsqueda es de lectura y queda guardada para no repetir llamadas por video.
