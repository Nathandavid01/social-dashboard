# Nate Media — Pipeline De Edición

Integrado en Social Dashboard. Para instalar, restaurar medios y entender las rutas históricas, leer [PORTABILITY.md](PORTABILITY.md).

Primer pipeline **local** de Nate Media. Usa el material de las ideas del dashboard, transcribe en español en el Mac y renderiza un MP4 vertical a partir de una edición guardada en JSON.

## Un prompt para varios videos

La entrada recomendada del agente es `python3 pipeline.py batch`: carga una vez
las instrucciones vigentes del cliente, prepara las piezas juntas y ejecuta el
lote localmente con avance guardado. Al corregir se crean versiones solo de las
piezas afectadas. Guía: [BATCH.md](BATCH.md). El flujo individual de abajo sigue
disponible para recetas existentes.

## Recursos y AI local

La transcripción reutiliza resultados por contenido, modelo y vocabulario; no
sobrescribe correcciones existentes. Los lotes cargan Whisper solo cuando queda
trabajo nuevo. Cortes, captions, efectos, mezcla y render siguen siendo locales.
Consulta [RESOURCE-AUDIT.md](RESOURCE-AUDIT.md) para hallazgos, límites de la caché
y uso del SSD externo. AI del agente se reserva para decisiones editoriales y
ambigüedades; no hace falta volver a analizar todo el material en cada revisión.

## Flujo

1. Leer las ideas de Nana’s con `node dashboard.mjs`.
2. Descargar el original desde **Bajar** en la idea del dashboard.
3. Vincularlo: `node dashboard.mjs --import VIDEO_ID /ruta/al/original.MP4`.
4. Transcribir: `python3 pipeline.py transcribe media/VIDEO_ID.mp4 runs/transcript.json`. Para nombres propios, añadir `--initial-prompt "Nombre del cliente, productos y lugares relevantes"`; sin esa opción Whisper no recibe vocabulario de otro cliente.
5. Revisar imagen y texto. El agente prepara un `edits/*.json` con cortes, encuadres, subtítulos y sonidos. La selección editorial sigue siendo asistida por el agente; el CLI no toma esas decisiones automáticamente.
6. Renderizar una nueva revisión: `python3 pipeline.py render edits/pregunta-v2.json runs/nanas-pregunta-v3.mp4`. Audio Kit nivela las intervenciones, equilibra música/outro y comprueba sonoridad y picos del AAC final automáticamente.
7. Ver el MP4 completo y ajustar la edición para la siguiente versión.

## Edit Kit

`editkit.py` es la herramienta del agente (igual que `effectkit.py` para efectos): verbos globales y un perfil por cliente en `styles/clients.json`. No sustituye `pipeline.py` ni las reglas de `AGENTS.md`. No pisa recetas ni exports.

```sh
python3 editkit.py clients
python3 editkit.py profile yabuuchi
python3 editkit.py status yabuuchi --idea primer-sushi
python3 editkit.py window runs/transcript.json --in 1.78 --out 10.05
python3 editkit.py new yabuuchi --idea slug --source MEDIA --transcript JSON --clips '[{"in":1.78,"out":10.05}]'
python3 editkit.py bump edits/slug-v1.json
python3 pipeline.py render edits/slug-v2.json runs/slug-v2.mp4
```

El pipeline conserva los originales y rechaza sobreescribir un MP4 final existente. El render incluye decodificación completa de control, duración y registro de la fuente mediante SHA-256. Estas comprobaciones técnicas no sustituyen la revisión humana del ritmo, audio y contenido.

## Audio Kit

Paso automático para todos los nuevos renders: preparación de voz por intervención, rampas suaves, compresión, balance de música/outro y masterización medida en dos pasadas. Genera `.audio.json` y añade un control obligatorio a la revisión. No publica ni modifica exports anteriores. La escucha crítica queda pendiente. Uso, ajustes por receta y comandos para exports externos en [AUDIO.md](AUDIO.md).

## Componentes

- `dashboard.mjs`: consultas **GET** limitadas al cliente Nana’s, catálogo, descargas R2 cuando la configuración del proveedor está disponible e importación de archivos bajados desde el dashboard. Usa el entorno existente; nunca copia credenciales al proyecto ni escribe en la base de datos.
- `pipeline.py`: Whisper local, sincronización de palabras tras cortes/reordenación, subtítulos ASS animados que ajustan su tamaño al ancho, encuadres, B-roll manteniendo la voz, outro, voz normalizada y sonidos sintetizados originales.
- `styles/nanas.json`: fuente DTMF de la carpeta suministrada, subtítulos blancos con borde magenta. Estilo pendiente de revisión con Eric; los sonidos de Instagram todavía no se han analizado.
- `edits/`: instrucciones de edición reproducibles y notas de revisión.
- `media/` y `runs/`: originales, transcripciones y resultados locales, excluidos de Git.

## Requisitos Del Mac

- Node 22+, Python 3.9+, NumPy, `openai-whisper`, PyTorch y FFmpeg con `libass`, `loudnorm`, `acompressor` y `alimiter`.
- Este Mac tiene FFmpeg completo en `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`; se puede cambiar con `FFMPEG`.
- `ffprobe` debe estar en PATH. Whisper descarga el modelo una sola vez; la transcripción se ejecuta localmente.
- El conector reutiliza las dependencias del dashboard padre (o `../social-dashboard` en el diseño histórico). `DASHBOARD_PATH` permite señalar otro checkout con `.env.local`.
- La fuente se conserva localmente en `media/brand/DTMF.ttf` y se resuelve respecto al archivo de estilo. También se necesita Pillow para medir el ancho real de los subtítulos.

## Piloto Completado Localmente

**Pregunta**, idea `2a9747d8-bda2-4087-80bc-8a36cafa69b8`:

- Original: 15.02 s; revisión 02: 15.47 s incluyendo el outro de 3.3 s.
- Se retiró la cuenta de grabación y se acortaron pausas. Se mantuvo el mensaje completo.
- B-roll `010c6074…`: niño en el trampolín durante el beneficio sobre juegos.
- B-roll `09609fa6…`: nachos y bebidas durante la mención de snacks.
- Fuente DTMF y outro oficial. Logo transparente disponible en el paquete; el cierre usa el logo animado del outro.
- Transcripción Whisper small revisada contra la idea; nombres de marca corregidos.
- Decodificación completa correcta; pico de audio medido -1.0 dBFS. Revisión visual de presentadora, B-roll, subtítulos y outro. El juicio final de ritmo y mezcla sonora queda para la revisión de Eric.
- Página de revisión comprobada en escritorio y 390 px sin desbordamiento; comparación original/edición, saltos temporales y notas con tiempo.

Ver: `runs/nanas-pregunta-v6.mp4`. Informe: `runs/nanas-pregunta-v6.json`.

Para abrir la revisión:

```sh
python3 review.py runs/nanas-pregunta-v6.mp4
python3 serve.py
```

Visitar http://127.0.0.1:3046/review.html. El servidor escucha solo en el Mac y soporta rangos de bytes para poder saltar a cada momento del video. `review.py` es la página específica del piloto Pregunta; el renderizador sí admite nuevas ediciones.

Los assets oficiales vienen de https://drive.google.com/drive/folders/1pin5gm6SkKJHUM03IA6Bho7zBwAoEvzV. Se obtuvieron mediante Google Drive; no se conservan URLs temporales de descarga.

**Hallazgo de material:** la idea Clima contiene una toma que apunta al mostrador durante toda la voz. No se usó como presentadora para este piloto. Su voz puede servir en otro montaje con B-roll adecuado.

## Estado De Integración

La lectura de ideas está conectada. Las credenciales locales actuales incluyen Entregas R2, pero no el proveedor R2 original usado por estos clips; **Bajar en el dashboard + importación local** es la vía comprobada para el piloto. No se presupone que ambos buckets sean intercambiables.

Todavía no hay botón de edición automática dentro del dashboard, cola de trabajos ni subida automática del resultado. No se modifica el estado de las ideas ni se publica el MP4. La página de detalle del dashboard puede generar por sí sola un borrador de caption al abrirse; esa es conducta existente del dashboard, independiente del pipeline.

## Validación

`python3 -m unittest -v`

Pruebas de palabras después de reordenar cortes, cortes que atraviesan palabras, rangos inválidos, agrupación de subtítulos y escape de texto ASS.

## Siguientes Incrementos

- Aprobar con Eric el primer estilo y ritmo sobre material real.
- Extender la biblioteca con más B-roll revisado, etiquetado por juegos, comida, instalaciones y ubicación.
- Añadir propuestas automáticas de cortes, manteniendo una revisión antes del render final.
- Integrar un botón y cola en el dashboard, con permisos de edición y revisión; requiere trabajo propio en ese repositorio.

Documentación técnica: [Whisper](https://github.com/openai/whisper) · [Filtros de FFmpeg](https://ffmpeg.org/ffmpeg-filters.html).

## Revisión De Estilo V4

Comparación visual con el reel DdMQ6pACktW: captions blancos con magenta cerca del 68% de altura, frases breves sin escala de entrada, y destellos con desenfoque de 200 ms al entrar B-roll. Fuente DTMF oficial. Clics mecánicos y barridos sintetizados; no son los archivos originales del reel ni se ha verificado identidad auditiva. Revisión exportada en 1080 × 1920, 15.47 s, decodificación completa correcta.

## Música V5

Fondo extraído de la diferencia estéreo L-R del reel proporcionado. Tramo 8.5–17.5 s, repetido con fundido de 350 ms, RMS -30 dBFS debajo de la voz, entrada de 180 ms y salida de 500 ms antes del outro oficial. `prepare_reference_music.py` reproduce el WAV. La comprobación Whisper small no detectó diálogo reconocible, pero no sustituye una revisión auditiva humana.

## Música V6 · Fuente Externa

Se sustituye la extracción de Instagram por Carefree, de Kevin MacLeod, descargada del sitio oficial Incompetech. Instrumental con ukelele, guitarra, marimba, glock y percusión, 96 BPM según el catálogo oficial. Alternativa alegre propuesta; no se afirma identidad con la canción de referencia. MP3 íntegro y procedencia SHA256 en media/music/. Crédito CC BY 4.0 listo en runs/CREDITO-MUSICA.txt y enlazado en la página de revisión.

Preparación reproducible:
```sh
ffmpeg -i media/music/Carefree.mp3 -t 12.15 -ac 2 -ar 48000 -af "loudnorm=I=-29:TP=-9:LRA=7,afade=t=in:d=0.15,afade=t=out:st=11.55:d=0.6" media/music/carefree-bed.wav
```

## Segundo Reel · Clima

Edición independiente en edits/clima-v1.json, transcripción small ajustada al brief y nombre de ubicación del dashboard. Preparación en prepare_clima.py. Render en runs/nanas-clima-v1.mp4; revisión con python3 review_clima.py runs/nanas-clima-v1.mp4 en /clima.html. Dos tomas de juegos cubren toda la narración. Música Happy Whistling Ukulele, biblioteca FreePD archivada bajo CC0, licencia y SHA256 en media/music/.

## Ciclo De Comparación Por Versión

Cada llamada a `pipeline.py render` ejecuta `review_loop.py`: vincula la idea del catálogo, inventaría y calcula hashes de las referencias y assets locales, genera una hoja de fotogramas y registra controles de formato, subtítulos y licencia. Produce un archivo `.review.json` junto al MP4. Las comprobaciones editoriales y auditivas quedan pendientes hasta que alguien las realiza; no calcula una puntuación de similitud ficticia.

Idea → Referencias → Montaje → Control técnico → Comparación visual → Comparación de audio → Revisión del usuario. Un hallazgo lleva a Corregir → Nueva versión → Comparar otra vez. AGENTS.md fija este procedimiento para las siguientes ediciones en esta carpeta. No es una automatización programada ni un revisor audiovisual autónomo.

Clima v2 registró dos hallazgos visuales; v3 desplaza el destello a un cambio real de plano y divide la ubicación. Página de comparación: /clima.html. Las referencias registradas son las descargadas y verificadas localmente, no toda la carpeta remota de Drive.

## Corrección Tipográfica · Clima V4
QUARTZO demo Bold sustituye DTMF. Comparación visual de la misma frase disponible en runs/ig-font.png y runs/quartzo-reference-match.png. Fuente efectiva verificada en log de FFmpeg. Perfil para siguientes ediciones: styles/nanas-quartzo.json. Licencia comercial pendiente de verificar; archivo suministrado marcado Personal Use Only.

## Clima V5 · Más B-roll Y Cortes
Ocho planos en 10.9 s de voz, procedentes de tres archivos revisados: trampolín, caballito y tiendita. Ocho acentos sonoros (cuatro clics y cuatro barridos) y tres destellos de 130 ms. QUARTZO, música CC0 y outro conservados. La comparación muestra la versión inmediatamente anterior.

## Clima V6 · Zooms Con Keyframes
Cada B-roll incluye zoom_keyframes con tiempo local y escala inicial/final (1.00–1.10). Interpolación smoothstep con easing y recorte centrado; zoompan d=1 preserva movimiento y duración. Subtítulos se componen después del zoom y conservan su tamaño. Nueve pruebas pasan y exportación completa decodificada.

## Herramientas De Efectos

Laboratorio local: http://127.0.0.1:3046/effects/index.html. Incluye sonidos, zooms, transiciones, fundidos de B-roll y exportación de recetas. Ver [EFFECTS.md](EFFECTS.md) para aplicar y renderizar.
