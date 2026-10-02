# Revisión de recursos · 26 de septiembre de 2026

## Resultado

El motor de edición inspeccionado ya trabaja localmente. Whisper es AI local;
FFmpeg, Audio Kit, captions, efectos y motion graphics son procesamiento local.
No se encontraron llamadas a OpenAI, Anthropic o Gemini en los archivos Python/MJS
inspeccionados del pipeline. Esto no mide el consumo de Codex/Claude usado para
decidir la edición ni servicios invocados fuera del pipeline. No se consultó
facturación y no se puede dar un ahorro monetario o de tokens observado.

## Cambios aplicados

- `pipeline.py transcribe` reutiliza inferencias por SHA-256 del original, modelo,
  versión de Whisper, idioma y vocabulario. Funciona también para copias con otro
  nombre. Caché pequeña de JSON en `runs/.transcription-cache`.
- Salidas existentes con procedencia coincidente se conservan, incluidas sus
  correcciones manuales. Una salida antigua o distinta exige otro nombre.
- JSON publicado completo sin sobrescribir archivos existentes. Un bloqueo evita
  dos inferencias simultáneas a través del helper. El modelo se carga solo si hace
  falta inferir y se reutiliza durante el mismo proceso/lote; máximo cuatro hilos
  de PyTorch. No limita globalmente otros programas, FFmpeg o scripts históricos.
- Los lotes `transcribe_batch.py` y `scripts/transcribe_yabuuchi.py` usan el helper;
  un lote ya completo no carga el modelo. Sus transcripciones antiguas se conservan.
- La huella del original en el render se calcula en bloques de 1 MB; antes cargaba
  todo el video en RAM. Audio Kit y review_loop ya usaban bloques.
- Se mantienen resolución, codec, calidad, mediciones de audio y revisión final.

## Disco observado

| Ubicación | Uso / disponible |
|---|---|
| Disco interno | 99% ocupado; unos 6.8 GiB disponibles |
| Extreme SSD, montado | unos 571 GiB disponibles |
| `video-pipeline/runs` | unos 12 GiB |
| `video-pipeline/media` | unos 4.4 GiB |
| 72 archivos `premaster.mkv` dentro de runs | unos 1.53 GiB |
| 272 archivos `sounds.wav` dentro de runs | unos 0.32 GiB |

Son lecturas puntuales y las categorías de intermedios forman parte de runs.
No se borraron ni movieron archivos. Para próximos renders, crear una carpeta en
el SSD y pasar el MP4 de salida allí. El motor crea los intermedios junto a la
salida; algunas galerías históricas presuponen archivos en runs y necesitarán
rutas adaptadas si se entregan desde otro directorio.

## Flujo recomendado

1. Consultar catálogo, perfil y receta existentes; reutilizar el material revisado.
2. Transcribir una vez localmente. Corregir solo palabras dudosas; una segunda
   inferencia se justifica por un problema específico, no por cada revisión.
3. Dar al agente el brief, la ventana de transcripción relevante y los fotogramas
   necesarios. Guardar decisiones en la receta y usar los kits para aplicarlas.
4. Usar B-roll real/catalogado y plantillas. Reservar generación de imágenes para
   una necesidad editorial que no quede cubierta; no generar video por defecto.
5. Agrupar correcciones, renderizar de uno en uno y revisar el export completo.
6. Mantener escucha crítica y aprobación pendientes hasta realizarlas.

## Límites pendientes

Los scripts históricos `scripts/recheck_delian_sept.py` y
`scripts/clarify_delian_hilo.py` aún usan Whisper turbo directamente: son revisiones
específicas, fuera del helper. No ejecutarlos como control habitual. Las rutas de
transcripción de otros proyectos/clientes fuera de esta carpeta no se migraron.
El modelo puede descargarse la primera vez si no está instalado; la inferencia
posterior corre en CPU. No se instaló un motor nuevo ni se cambió a GPU sin medir
compatibilidad, tiempos y calidad. No se lanzó ningún render ni inferencia real
como parte de esta auditoría.

## Validación

71 pruebas del pipeline completadas correctamente, incluyendo siete pruebas
nuevas de caché, cambios de fuente/modelo/vocabulario, correcciones manuales,
concurrencia y fallos. Las inferencias de estas pruebas están simuladas: no
miden velocidad ni precisión de Whisper. Los cuatro archivos Python cambiados
y añadidos compilan correctamente. Cambios locales; sin publicación ni deploy.

## Actualización: flujo desde el prompt

La primera auditoría cubría el motor. Ahora `pipeline.py batch` conecta el contexto
del cliente, selección conjunta, preparación, decisiones para varias piezas, render
y reanudación. `AGENTS.md` lo establece como entrada predeterminada del agente.
Ver `BATCH.md` para uso y evidencia: 82 pruebas y tres renders sintéticos reales
con reanudación sin repetir exports. No se ha medido ahorro de tokens en un lote
real de clientes.
