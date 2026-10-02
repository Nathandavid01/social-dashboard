# Reglas compartidas del pipeline

Leer primero [GLOBAL-EDITOR-RULES.md](GLOBAL-EDITOR-RULES.md). Las rutas `video-pipeline/` parten de la raíz del dashboard. Los archivos de medios y rutas históricas requieren restauración local; consultar [PORTABILITY.md](PORTABILITY.md).

# Nana’s Playhouse Video Workflow

## Aprender De Cada Corrección Del Usuario
- Después de cada cambio solicitado, identificar qué se puede reutilizar y actualizar estas reglas y el perfil correspondiente antes de entregar la revisión. No pedir al usuario que repita la preferencia.
- Preferencias generales del cliente van aquí; parámetros de audio en `styles/nanas-audio.json`; typography en `styles/nanas-quartzo.json`; decisiones particulares en `styles/nanas-feedback.json`; defectos y usos de tomas en el catálogo B-roll. Mantener una sola fuente para cada parámetro.
- Registrar motivo y alcance: global, tipo de video o video específico. Una toma rechazada en un contexto no queda prohibida para todos los clientes ni para cualquier idea.
- La corrección más reciente prevalece: actualizar o sustituir la regla anterior, evitando instrucciones contradictorias. No tratar una entrega sin respuesta como aprobación.
- Al iniciar otro video, cargar reglas, perfil, feedback y usos actuales del catálogo. Reutilizar lo aprendido; revisar de nuevo sólo rangos nuevos, cambios y riesgos concretos. Completar siempre la verificación de la nueva exportación hasta el outro.
- En la entrega, mencionar brevemente la regla nueva o ajustada si hubo una; no prometer ahorro fijo de tokens ni aprobación auditiva sin escucha.

## Teléfono En Captions · Global (Eric 2026-09-23)
- El número de teléfono nunca lleva punto afuera («787-230-7573», no «787-230-7573.»); una coma natural de la frase se conserva. Solo aplica al teléfono; el resto del texto conserva su puntuación. `pipeline.py` lo limpia en cada render (`clean_caption_text`, test `test_phone_numbers_never_carry_trailing_punctuation`); no reintroducirlo en gráficas ni tarjetas de contacto.

## Pregunta Detrás De Cámara · Global (Eric 2026-10-02)
- Cuando la pregunta la dice alguien detrás de la cámara, esa tarjeta invierte los colores del cliente: el texto toma el color de la caja (o del borde, si no hay caja) y la caja o el borde toma el color del texto. La respuesta y cualquier pregunta dicha a cámara conservan la paleta normal.
- La marca es `behind_camera: true` en esa caption de la receta. Un signo de interrogación no basta, y el color de pregunta de Truco o Cheesys no se sustituye por esta inversión. El renderer hace el cambio en `inverted_caption_colours`; la receta sigue guardando los colores normales del cliente. Prueba: `test_behind_camera_question_inverts_box_and_outline`.

# Edit Kit · herramientas del agente
Motor global + perfil por cliente. Imita `effectkit.py`: nunca pisa un archivo, no elige B-roll por su cuenta y no marca aprobación. Las reglas editoriales siguen en este archivo y en `styles/*-feedback.json`.

```sh
python3 editkit.py clients
python3 editkit.py profile yabuuchi
python3 editkit.py status yabuuchi --idea churrasco-roll
python3 editkit.py inspect edits/yabuuchi-seleccion-churrasco-roll-v5.json
python3 editkit.py window runs/transcript.json --in 1.78 --out 10.05
python3 editkit.py new yabuuchi --idea slug --source MEDIA --transcript JSON
python3 editkit.py captions edits/slug-v1.json
python3 editkit.py bump edits/slug-v1.json --note "corrección"
python3 editkit.py broll edits/slug-v1.json --source MEDIA --in 0.3 --out 2 --at 4.8 --reason "producto nombrado"
python3 graphickit.py grab VIDEO.png --ss T --crop x,y,w,h --cutout
python3 graphickit.py apply edits/slug-v1.json edits/slug-v2.json --image PNG --start A --end B --pop
python3 pipeline.py render edits/slug-v2.json runs/slug-v2.mp4
```

Gráficas: solo PNG con canal alfa (fotos recortadas, sin fondo). `graphickit.py` recorta y `pipeline.py` las superpone; no dibujar iconos planos ni tapar captions.

Al pedir un video nuevo: cargar `profile` y `AGENTS.md` del cliente, usar `window` para cortes, `new`/`bump` para la receta, captions como borrador a corregir, B-roll literal o nada, render con versión nueva. No mezclar Nana’s, Arecibo, Yabuuchi, Truco ni Cheesys.

## Audio Kit · obligatorio antes de terminar cualquier reel
- Solicitud de Eric del 21 de septiembre: normalizar profesionalmente todos los reels antes de dar el editaje por terminado. `pipeline.py render` integra `audiokit.py` automáticamente para todos los clientes. Valores únicos en `styles/audio-master.json`; documentación en `AUDIO.md`.
- Separar nivelación de las intervenciones habladas y masterización de la mezcla completa. Revisar los rangos de pregunta/respuesta; la agrupación automática por transcripción no equivale a identificar hablantes. Conservar filtros de limpieza específicos y balances manuales con `audio_master.voice_mode=preserve` cuando corresponda.
- El AAC entregable debe tener `.audio.json` aprobado y vinculado a su hash. Un render externo requiere `audiokit.py normalize` o un informe equivalente validado antes del cierre. No marcar terminado si falla el control o quedan avisos de voz sin revisar. Escucha crítica y reproducción hasta el outro siguen siendo controles separados.
- Conservar originales y versiones previas; no aplicar revisiones a entregas publicadas ni a Recibo automáticamente. La normalización no repara distorsión ya grabada. No imponer a otros clientes reducciones particulares de un video.

Estilo publicado (Metricool): `styles/metricool-learned.json` y contact sheets en `runs/metricool-tomorrow/style/<slug>/contact.jpg`. Si el cliente está ahí, copiar familia de captions/outro; no inventar otra paleta.

For each new edit or revision in this folder:
1. Read the matching idea in runs/catalog.json; preserve the meaning of recorded speech.
2. Compare with the supplied Instagram reel (media/reference), client folder example (media/brand/style-reference.png), official font/outro, and prior local examples. Describe unavailable references explicitly.
3. Use relevant B-roll; review actual frames, not filenames alone. Follow the user's music constraints: commercial use without mandatory attribution, retain license evidence.
4. Render a NEW version via pipeline.py. Every render invokes review_loop.py to produce a hash-bound evidence graph and contact sheet.
5. Inspect the generated contact sheet against the reference and previous version. Record concrete findings in the version's .review.json. A successful encode is not editorial approval. Audio similarity requires actual listening; automated transcripts do not prove it.
6. Correct findings with another edit/version and repeat. Do not overwrite exports. Keep unresolved checks pending and expose them in the comparison page.
7. Update review_clima.py or the matching review surface with the current render and evidence. Verify playback metadata, visible captions, and navigation. Leave user review pending; publishing is a separate action.

The graph is a workflow per edit, not a scheduled background monitor. Never invent similarity scores, claim every Drive file was checked when only local assets were checked, or mark human approval automatically.

Eric 2026-10-02: el grafo es obligatorio antes de terminar CADA revisión, incluso cambios pequeños y outros independientes. Aplicar la sección «Grafo obligatorio en cada revisión» de `../AGENTS.md`: examinar evidencia de la exportación exacta, corregir y repetir en otra versión. Un grafo generado automáticamente no cierra controles editoriales ni auditivos pendientes; en ese caso el resultado sigue siendo borrador.

## Fuente Confirmada Visualmente
El reel Instagram DdMQ6pACktW usa formas que coinciden con QUARTZO demo Bold; NO usar DTMF para replicar sus subtítulos. Usar styles/nanas-quartzo.json en nuevas recetas. El screenshot DTMF de la carpeta corresponde a otro tratamiento de texto y no prevalece sobre el reel. Archivo QUARTZO suministrado marcado PERSONAL USE ONLY: verificar licencia comercial antes de afirmar que está listo para publicación comercial.

## Nuevos Reels · Criterios Confirmados
- Vincular cada B-roll a la frase que ilustra; conservar el presentador si no hay material pertinente. No repetir una toma de apoyo dentro del mismo reel.
- Consultar media/broll-index.json y runs/nanas-batch-manifest.json antes de volver a analizar archivos o editar una idea ya terminada.
- Mantener captions QUARTZO de 85px mediante frases más breves; evitar ajustes automáticos de tamaño.
- QUARTZO demo dibuja símbolos en algunos dígitos: usar Arial Bold a los mismos 85px para teléfonos y marcadores numéricos hasta disponer de la fuente completa.
- En clips de apoyo con personas, priorizar acciones reales sin presentación a cámara. Descartar rangos donde alguien lea un guion o hable como presentador; no ocultarlo con recortes que dejen cuerpos extraños o eliminen el contexto.

- Variar B-roll también entre reels del lote. La toma del niño en trampolín (010c6074) se limita a un solo reel por lote; no usarla como apoyo genérico. Si no hay otra toma pertinente, conservar al presentador.

## Biblioteca B-roll Completa
- Priorizar cobertura del catálogo completo entre todos los videos del cliente: consultar usos del lote y de videos anteriores antes de elegir; entre tomas pertinentes, usar primero las no utilizadas y luego las menos usadas. Repetir solo cuando no haya otra toma adecuada. No forzar un B-roll ajeno al diálogo para completar el catálogo.
- Fuente de consulta: media/BROLL-NANAS.md y media/broll-index.json; vista visual en runs/broll-catalog/index.html.
- Antes de editar, buscar por tema con `python3 broll_library.py --search "tema"`. Priorizar la pertinencia; entre opciones equivalentes, seleccionar la menos usada.
- Contar repeticiones por hash y familia de escena, no solo por nombre: dos UUID pueden contener el mismo video.
- Los rangos del catálogo son sugerencias basadas en muestras visuales. Comprobar el tramo exacto, movimiento, foco y si hay bocas hablando antes de cortar. Silenciar audio original del B-roll.
- Aprovechar la mayor variedad posible a lo largo del lote; no forzar todos los archivos ni tomas irrelevantes en cada reel.
- Después de actualizar las versiones actuales, ejecutar `python3 broll_library.py` para recalcular usos del catálogo. Mantener rangos y notas para evitar reanalizar todo en cada pedido.

## Música Y Ambiente
- Variar estilos musicales entre reels del lote según la idea; no reutilizar automáticamente el mismo ukulele ni cambiar solo el título de una música equivalente. Registrar pista, fuente y licencia.
- En listas, añadir un click breve al inicio de cada punto; no a cada palabra. Evitar superponer whoosh y click en el mismo instante.
- Aplicar a todos los reels la mezcla común aprobada: voz al frente (objetivo -16 LUFS), música perceptible (objetivo inicial -27 LUFS) y reducción del ambiente de la grabación. Ajustar por escucha para mantener la voz natural; los objetivos numéricos no garantizan el mismo balance perceptual. Conservar inteligibilidad; no prometer eliminar voces de fondo mezcladas con el diálogo. Escucha crítica pendiente si no se puede escuchar realmente.

## Sonido Del Outro
- Usar media/brand/outro-with-star-sfx.mov (ganancia 1): whoosh de estrella, aterrizaje suave y campanillas sincronizadas con el logo, con caída de volumen hasta terminar.
- Diseño sonoro original en media/brand/outro-star-sfx.wav; tiempos en el JSON contiguo. No mezclar de nuevo el mismo efecto encima del outro ya sonorizado.

## Mezcla Común · Nana’s
- Receta reutilizable: styles/nanas-audio.json. Mantener pistas distintas por reel, clicks por puntos y outro sonorizado. Evitar arranques musicales silenciosos.
- Herramienta de actualización del lote: unify_nanas_audio.py; conserva imagen/cortes/captions y versiones anteriores.

## Ritmo, Captions Y Gráficas
- Conservar frases y pausas naturales. Evitar gestos de preparación o expresiones incongruentes al inicio; cubrir sólo ese tramo con una gráfica breve de marca si hace falta.
- Evitar regresos al presentador de apenas unos fotogramas entre B-rolls, cortes entre sílabas, zooms bruscos y flashes o whooshes acumulados. Mantener una toma continua cuando comunique mejor.
- El B-roll debe demostrar lo dicho: jugar con bloques no equivale a limpiar; una piscina genérica no explica cualquier tema. Si no hay material adecuado, mantener al presentador.
- Escribir el nombre completo «Nana’s Playhouse» al identificar el negocio en captions; dividir en dos líneas antes que reducir los 85px.
- En enumeraciones: un click mecánico marcado por punto, sincronizado al inicio de la frase; usar el preset `list_click` del perfil de audio. Si se muestran números, sincronizar 1/2/3 y evitar caras/captions.
- Las tarjetas de contacto usan el logo oficial y mensajes que cambien con la narración: teléfono cuando se dicta, redes cuando se mencionan. No incluir el horario de otra pieza si no se está hablando de horarios.

## Reservas De B-roll Por Lote
- Antes de reutilizar una toma, consultar `styles/nanas-broll-reservations.json`: cada fuente de apoyo queda reservada a un solo video del lote actual. Cambiar el rango, recortar o renombrar un archivo no lo convierte automáticamente en una toma nueva.
- Ejecutar `audit_nanas_broll.py` después de cambiar las versiones actuales para verificar conflictos y regenerar reservas. Gráficas de marca y planos del presentador se distinguen de B-roll.
- La exclusión de Dulces Y Bebidas, Un Plan Para Mamá Y Papá y Dónde Celebrar Su Cumpleaños corresponde a esta revisión: conservarlos hasta que el usuario pida editarlos.

## Videos De Reglas
- Buscar B-roll que demuestre cada regla y sincronizarlo con la frase exacta. Prohibiciones mostradas con objetos reales deben llevar una señal inequívoca de prohibición.
- Mostrar acciones correctas para ilustrar uso del equipo. No afirmar características que no se ven, como suelas antideslizantes, ni presentar juguetes del local como externos. Si falta evidencia visual, mantener al presentador.
- Registrar el origen de clips con símbolos o recortes en el catálogo y en la auditoría, para que sigan contando como la misma toma.
- Si la voz menciona una conducta prohibida y la imagen muestra el comportamiento correcto, rotular explícitamente ese ejemplo positivo para evitar ambigüedad.

## Kit Reutilizable De Efectos
- Antes de programar sonidos/transiciones nuevos, consultar `EFFECTS.md` y `python3 effectkit.py list`; laboratorio en `/effects/index.html`. Reutilizar presets y ajustar tiempos/intensidad en la receta.
- Los presets están definidos en `effects.py`; la UI se genera desde esa misma fuente. Ampliar ahí cuando una nueva corrección justifique un efecto reutilizable y conservar compatibilidad con recetas anteriores.
- Exportar/copiar desde el laboratorio no cambia videos: aplicar a una receta nueva y renderizar/revisar antes de actualizar la galería. Previews aisladas no sustituyen escucha de la mezcla final.

## Listas Con Gráficas Animadas
- Para listas como «Tres Cosas Menos De Qué Preocuparte», usar un gancho breve con el número visible desde el primer fotograma y una jerarquía clara por punto. Animar entradas e iconos con suavidad; mantener captions uniformes y voz continua.
- Cuando no exista B-roll literal para un concepto (limpieza o prestar la casa), usar una ilustración claramente gráfica y semántica. Mantener el B-roll real para acciones comprobables, sin añadir afirmaciones nuevas.
- No superponer logo, números, caras o captions. Sincronizar un click fuerte por punto; los whooshes suaves acompañan cambios reales sin acumular efectos en la enumeración.
- Herramienta reutilizable: `motion_cards.py` con especificación JSON (ejemplo: `edits/practico-motion-v14.json`). Plantillas hook, clean, home y broll. Los clips compuestos con tomas reales deben conservar `original_source`, `source_in` y `source_out` en la receta para que el catálogo/auditoría cuente el material original. Las gráficas puras usan `kind: brand_graphic`.

# Arecibo Lab (cliente 2) · mismo pipeline, reglas propias
- Estilo: `styles/arecibo.json` = Montserrat Bold 70px FIJO (nunca encoger; `fixed_size` parte en 2 líneas balanceadas), texto blanco sobre caja verde del logo #9CE608 (`border_style` 3). Aprobado por Eric 2026-09-15 (v18). No mezclar con el estilo de Nana's.
- Media: `media/arecibo/` (crudos DJI por hardlink, `brand/Montserrat-Bold.ttf`, `brand/outro.mp4`). Catálogo de ideas local `runs/arecibo-catalog.json` (no hay ideas en el dashboard); la receta declara `"catalog"` y `"references"` propias para `review_loop.py`.
- Recetas `edits/arecibo-<idea>-vN.json`, salidas `runs/arecibo-<idea>-vN.mp4`. Transcripciones en `../arecibo-lab-video/transcripts/` (Whisper small con vocabulario del cliente); copiar a `runs/arecibo-<clip>-transcript.json` para la receta.
- Biblioteca de crudos y qué dice cada toma: `../arecibo-lab-video/media/BROLL-ARECIBO.md` (`python3 biblioteca.py --search`). Tomas habladas nunca como B-roll; una sola fachada por reel (0298/0299/0300).
- El pipeline rechaza cortes dentro de una palabra (tolerancia 15 ms): validar `cut_words` con la transcripción antes de fijar `clips`. Cuenta de claqueta ("tres, dos, uno") siempre fuera.
- Recorte de privacidad (monitores con datos) se hace como clip derivado en `media/arecibo/*-crop.mp4` con `original_source`/`source_in`/`source_out`, igual que las gráficas de Nana's.
- Ejemplo vivo: `edits/arecibo-desde-cero-v1.json` → `runs/arecibo-desde-cero-v1.mp4` (réplica de v18).

# El Truco de Guin (cliente 3) · dashboard social-dashboard
- Cliente `7dd62e83-acc5-45eb-aba1-237987e9f4ff`. Listar/importar: `node dashboard.mjs --client truco`. Catálogo `runs/truco-catalog.json`; medios `media/truco/`. No mezclar estilo con Nana’s ni Arecibo.
- Estilo: `styles/truco.json` medido de `media/truco/TrucoReel53.mp4`. Impact 80px fijo, mayúsculas, borde negro 6px, captions al pecho (`bottom_margin` 800). Amarillo `#F1E414` (`&H0014E4F1`) en preguntas/ganchos; blanco en respuestas. Recuadros de comida con borde amarillo, sincronizados con lo que se nombra; no rellenar con comida ajena. Outro oficial `media/truco/brand/outro.mp4` (logo circular + «Un juego de sabores», 3 s). Aprobación de Eric pendiente.
- Las tomas crudas del dashboard están en el bucket R2 original (`storage_provider: r2`). Este Mac solo tiene Entregas R2; para editar un crudo hay que Bajarlo en el dashboard e `--import`, o añadir `R2_*` al `.env.local` del dashboard. No afirmar que un crudo se descargó si solo se listó el catálogo.
- Ideas grabadas listas para montar cuando exista el archivo: Bistec o Pastrami?, Ideas de Wilfreddy, Gaby se enamora del truco, ¿Pastrami o Bistec?, ¿Como esta ese Sandwich?, ¿$7.99 te salva la quincena?, El primer sandwich del día. Recetas `edits/truco-<idea>-vN.json`.

## B-roll Por Defecto · Arecibo Lab (2026-09-19)
- En cada video de Arecibo Lab, buscar activamente e integrar B-roll siempre que haya una toma pertinente. Consultar el catálogo antes de montar, relacionar cada inserción con la frase, evitar repeticiones dentro del reel y priorizar tomas menos usadas entre reels. No usar personas hablando bajo narración ajena ni material de relleno. Si no existe una toma adecuada, conservar al presentador y registrar la limitación. Perfil: `styles/arecibo-feedback.json` en video-pipeline.

# Yabuuchi Sushi · Toa Baja (2026-09-20)
- Cliente dashboard `0b870c21-70f0-44ad-8319-352e55cf377f` (nombre registrado YabushiSushi). Crudos en `media/yabuuchi/source/`; inventario Drive/Mac con tamaños y hashes en `runs/yabuuchi-source-inventory.json`.
- Referencia principal aportada por Eric: `media/yabuuchi/brand/primary-edit-reference.mp4` (original `Downloads/video 1.2.mp4`). Prevalece sobre el introductorio anterior. Aplicar su tratamiento de captions, sonidos, B-roll y gráficas, ajustado al diálogo real.
- Perfil vigente `styles/yabuuchi-reference-v4.json` y preferencias `styles/yabuuchi-feedback.json`. Captions blancos, negrita, sombra oscura, frases naturales de hasta dos líneas en zona baja, sin tapar ojos. Corrección de Eric: el tamaño anterior 52 quedó pequeño. Usar Arial Black a tamaño ASS 72 fijo, comparado en fotogramas nativos 1080×1920 con la muestra de la izquierda (letras altas visibles 36–37 px frente a 35–38 px en la referencia). Máximo dos líneas sin encoger; no es fuente oficial confirmada.
- B-roll semántico, acercamientos suaves, gráficas pequeñas sincronizadas (sin cubrir rostros ni captions), sonidos contenidos. Cierre de la referencia en `media/yabuuchi/brand/reference-outro.mp4`. No afirmar identidad de música/efectos sin comparación auditiva.
- Lote reciente: grabación 14 de septiembre, carpeta Drive Toa Baja, 32 originales. Catálogo `runs/yabuuchi-catalog.json`; recetas `edits/yabuuchi-*-vN.json`. Mantener procedencia de clips derivados y evitar reutilizar el mismo B-roll.
- Revisión pendiente: toma 0983 parece invertir nigiri/sashimi; 0019 y 0020 dan horarios contradictorios. Usar ubicación 0018 sin horario. No corregir el sentido del audio con subtítulos contradictorios; señalar nombres o frases no confirmados.
- Selección solicitada por Eric: cuatro videos revisados, todos con B-roll real y pertinente, similares a la referencia. Priorizar los que permiten eliminar frases dudosas sin alterar el sentido. Comprobar los cuatro completos, conservar el remate visible en sketches y cerrar piezas de producto con el producto terminado. No equiparar niveles medidos o transcripción automática con escucha crítica.

## Ideas Completas Y Nuevo Outro · Yabuuchi (corrección 2026-09-20)
- No entregar extractos a mitad de una idea: conservar apertura, desarrollo, desenlace y una pausa natural antes del logo. En sketches no cubrir con B-roll la entrada, pregunta, respuesta o entrega; en recetas incluir enrollado, corte, acabado y entrega. No eliminar el final «Aquí está» de 0006 ni la apertura de 0023.
- Outro vigente: `media/yabuuchi/brand/outro-elegant-piano-v1.mp4`, ganancia 1. Música «Elegant Piano Logo», Universfield, con caída suave; licencia y procedencia en `media/music/Elegant Piano Logo - Universfield.provenance.json`. Reemplaza el audio extraído de la referencia, que Eric pidió cambiar. La animación visual y los captions de tamaño ASS 72 se conservan.

## Swooshes Y Barridos · Yabuuchi (corrección 2026-09-20)
- Recrear el swoosh y el barrido breve de la referencia juntos en cambios importantes de plano. La referencia tiene ataque rápido antes del corte y cola corta; no usar solo un ruido tenue que empieza después del cambio.
- Presets `whoosh_sweep` (0.32 s, inicio 114 ms antes del corte) y `whip_pan` (0.20 s centrado, intensidad inicial 0.65). Ajustar al fotograma real; captions permanecen nítidos y quietos. Niveles iniciales de la selección: −19 a −16 dB de pico, sujetos a escucha crítica.
- Regla vigente de Eric: sonorizar cada transición editorial de Yabuuchi (entrada de B-roll, regreso al plano principal, cambio de escena y entrada al outro) en nuevas ediciones y revisiones. Un efecto corto por transición, sincronizado y por debajo de la voz. No añadir sonidos por caption/palabra ni duplicar los ya integrados al outro. Parámetros y criterio único en `styles/yabuuchi-feedback.json#transition_sound_rule`; revisar cobertura de los cortes y colas completas. Conservar el desenlace, el piano y la naturalidad de la voz. Auditoría de referencia en `runs/yabuuchi-swoosh-reference-qa/reference-audit.json`; no afirmar identidad auditiva sin escuchar.

## Los Cheesys · Reel Basado En Toma Hablada
- Corrección de Eric: para esta solicitud usar una toma original con persona hablando, voz real e idea completa. El montaje «¿Qué Se Te Antoja Hoy?» no cumple el encargo y no es referencia de aprobación.
- Referencias de estilo: `../cheesys-video/ESTILO-HECHOS.md` y los cinco MP4 de HECHOS. Captions blancos con contorno naranja/dorado en respuestas y negro en preguntas; posición baja, frases naturales y cierre oficial.
- Mantener B-roll pertinente al diálogo; no sustituir piña colada por otra bebida ni mezclar ubicaciones como si fueran la misma. Si el producto ya está en manos de la presentadora, conservarla cuando no exista apoyo específico.
- Corrección posterior de Eric («no tiene B rolls»): integrar apoyo real sobre la voz continua cuando exista material pertinente. Para ubicación, usar tomas del local correcto; no entregar solo presentadora sin revisar el banco. Registrar fuentes y rangos del apoyo.

## Biblioteca B-roll · Yabuuchi (2026-09-20)
- Consultar `media/yabuuchi/BROLL-YABUUCHI.md` e índice `media/yabuuchi/broll-index.json` antes de editar; vista en `runs/yabuuchi-library/index.html`. Buscar con `python3 scripts/build_yabuuchi_library.py --search "tema"`.
- Cobertura: originales de los lotes 9 y 14 de septiembre dentro de las seis carpetas accesibles de Yabuuchi Sushi en Drive. No contar accesos directos ni proxies LRF como nuevas tomas. El lote del 9 no tiene sede confirmada: no atribuirlo a Toa Baja automáticamente.
- Priorizar tomas pertinentes y luego menos usadas, contando también familia de escena y hash. Usos actuales se recalculan desde `runs/yabuuchi-selection-manifest.json` y `runs/yabuuchi-additional-current-reels.json`; regenerar con `python3 scripts/build_yabuuchi_library.py` después de revisar versiones.
- Rangos en segundos del original identificados por muestras visuales: revisar el movimiento del tramo exacto antes del montaje y silenciar su audio. No usar presentadores hablando como apoyo genérico. Mantener notas sobre productos no identificados, arranques fallidos y tomas incompletas.
- Nuevos originales del 9 de septiembre alojados en `Extreme SSD/Nate Media/video-pipeline/media/yabuuchi/source` y enlazados a la ruta habitual. Mantener el SSD conectado para editar o descargar originales. No borrar ni reemplazar los originales existentes.

## B-roll Recortado · Yabuuchi (corrección 2026-09-20)
- Cada vez que una toma tenga partes no utilizables como apoyo, cortarlas y dejar sólo B-roll en la versión principal de la biblioteca. Aplicar también a nuevas incorporaciones; no basta con señalar rangos sobre un crudo que conserva diálogo o preparación.
- Retirar esperas, manos del equipo que obstruyan, rostros presentando, sacudidas, desenfoques y finales vacíos. Revisar inicio, centro y final de cada tramo y ampliar muestras en límites dudosos. Si nada resulta aprovechable, dejar el archivo fuera de B-roll.
- Entregar tramos físicos separados y una versión limpia por toma, sin audio. Conservar originales en el archivo, con descarga secundaria, y mantener el vínculo fuente/rangos/hash/familia para contabilizar usos.
- Motor: `scripts/trim_yabuuchi_library.py --version N --watch`; revisiones en `runs/yabuuchi-library-cut-review-*.json`, manifiesto por versión y puntero vigente `runs/yabuuchi-library-clean-current.json`. Mostrar en la biblioteca sólo la versión cuyos archivos y reproducción estén verificados. No sobrescribir exportaciones anteriores.

## Caption Similar Al Titular De Marca · Yabuuchi
- Corrección vigente: usar Anybody Expanded Black (peso 900, ancho 125), tamaño 72 fijo, blanco con sombra, en el video Historia y nuevas ediciones. Perfil `styles/yabuuchi-reference-v5.json`. Aproxima visualmente «Un sushi de fantasía»; no afirmar que es la Knockout oficial. Prioriza esta elección sobre Arial Black anterior. Máximo dos líneas, dividir frases antes de encoger. Licencia OFL junto al archivo de fuente.

## Entrada Del Caption · Yabuuchi
- Solicitud vigente: aplicar al caption el efecto del ejemplo. Perfil `styles/yabuuchi-reference-v6.json`, fuente Anybody Expanded Black ya elegida, con `reference_soft_in`: aparición70ms y escala98→100 en110ms, luego estable. Recreación visual del cambio de texto de referencia en1.967–2.267s. No añadir sonidos por palabra.

## Viento · Yabuuchi
- En Historia0004, Eric pide reducir un poco el viento conservando la voz natural. Tratamiento ligero sólo en voz, sin filtrar música/efectos/outro; conservar versión previa para comparar. Parámetros en receta v8; ajustar por toma, no copiar agresivamente. La medición espectral no sustituye escucha crítica.

## Nivel De Voces · Yabuuchi
- En «Elige tu favorito», Eric reporta que la voz de las preguntas está demasiado fuerte. Equilibrar entrevistadora y respuestas por separado, con rampas suaves y control de picos; no resolver diferencias grandes entre micrófonos normalizando sólo todo el diálogo junto. Parámetros específicos y alcance en `styles/yabuuchi-feedback.json#elige_tu_favorito_voice_request`; no copiar la reducción exacta a otras tomas sin medir. Mantener la revisión auditiva del usuario pendiente.

## Foto Histórica · Yabuuchi
- En Historia, mostrar foto de Keiko durante su mención. Foto del sitio oficial en `media/yabuuchi/brand/keiko-historia-web.jpg`, con procedencia al lado; tarjeta v1 conserva foto con Carlos. No usar rostros genéricos o generados como personas históricas.

## Revisión De La Baby · Yabuuchi (2026-09-21)
- Eric indicó que el video 09 aún necesita mejor edición. La selección v7 no está aprobada. Revisar La Baby con el perfil vigente v6, Audio Kit y todos los cambios de plano sonorizados; conservar la apertura y la invitación completas. Registrar el nuevo corte y su revisión en `styles/yabuuchi-feedback.json#la_baby_revision_request`. Esta corrección es específica de La Baby.
- En la invitación de La Baby (0002), Eric detectó «y tres» antes del diálogo. La revisión recorta 0.00–0.50 s del original como conteo previo y conserva «Y si aún no lo has probado». No confiar en el primer token largo de Whisper para dar por limpio el inicio; al revisar estos casos, comprobar el rango previo a la voz y sincronizar de nuevo el caption.

## Roll Y Rollo En Captions · Yabuuchi (2026-09-21)
- Respetar la palabra pronunciada en cada frase: puede ser «roll» o «rollo». No convertir automáticamente una en otra ni aplicar un reemplazo global. Eric corrigió «¿Quieres un roll?» (Aprende A Decir Que No) y «¿Quieres otro roll?» (Otro Rollo). Transcripción automática y guion no sustituyen cotejo de la voz; si no hay escucha real, no afirmar que se escuchó ni que el resto está confirmado. Fuente única de esta regla: `styles/yabuuchi-feedback.json#literal_roll_caption_rule`.

## Remate Del Pedido · Yabuuchi / Otro Rollo (2026-09-21)
- Eric precisó que después de «¿Quieres otro roll?» debe entregarse el roll, no una bebida. En este sketch, retirar el plano Ramune 0014 y mostrar una entrega real de comida y el roll visible. La acción de cierre debe resolver el producto pedido; una sonrisa o movimiento similar a la referencia no basta si cambia el objeto. Esta exclusión de Ramune es específica de Otro Rollo. Preferencia en `styles/yabuuchi-feedback.json#otro_rollo_final`.

## Lista De Revisión · Yabuuchi (2026-09-21)
- Mostrar la muestra original arriba como «Demo de referencia», separada de la lista numerada de ediciones. No contar el demo como un video editado. Orden vigente en `styles/yabuuchi-feedback.json#delivery_sequence`; esta corrección sustituye la numeración anterior que reservaba el número 2 a la muestra.

## Comparación Nigiri Y Sashimi · Yabuuchi (2026-09-21)
- Última corrección de Eric: quitar el rótulo «Imagen ilustrativa» de las fotos y comparación final de este video. Esta instrucción sustituye el requisito anterior de rotular esos recursos en pantalla; conservar procedencia en la receta. v13.
- Corrección de audio: Eric detecta pausa y corte abrupto al pronunciar los nombres. Mantener nombre+verbo de un mismo fragmento original, sin silencio insertado dentro de la frase; cruces breves entre palabras y captions continuos. v12 ajusta los empalmes; escucha crítica sigue siendo necesaria.
- Corrección vigente: priorizar videos específicamente de sashimi/nigiri. Si no existen tomas confirmadas, animar imágenes específicas (movimiento de cámara, entradas de nombres y comparación final); no usar rolls genéricos ni tarjetas inmóviles. v11 conserva el montaje de voz de v10 y añade estos movimientos.
- Reedición del antiguo video 11 (ahora 10). Corrección vigente: mejores imágenes durante la explicación y nombres audibles de ambos productos. v10 monta «sashimi» y «nigiri» de la voz original antes de la definición correcta, con procedencia exacta en la receta. El crudo invierte ambos nombres; no conservar el error ni ocultarlo con captions contradictorios. Cubrir empalmes de palabras con imágenes ilustrativas y declarar el montaje; no afirmar que fue una frase continua ni usar sincronía labial falsa. Verificar nombre, descripción, imagen y caption como conjunto. Escucha crítica pendiente. Sin «Sushi en un minuto» ni «¿Cuál prefieres?». Outro `outro-ig-reel-v1.mp4`.
- Verificar el objeto de cada gráfica: los recortes previos representaban aderezo y un roll relleno; no ilustran sashimi y nigiri. Si falta toma real, identificar explícitamente las imágenes educativas generadas como ilustrativas y registrar que no son B-roll ni platos fotografiados del cliente. Preferencia y estado en `styles/yabuuchi-feedback.json#sashimi_nigiri_reedit`.
- Arranque de Nigiri y Sashimi (Eric 2026-09-24): la sílaba inicial, más fuerte y poco clara, no entra. La pregunta empieza en «¿Cuál». El conteo «Y tres» del crudo 0983 sigue fuera. No bajar el resto de la pregunta. Receta v16; `styles/yabuuchi-feedback.json#sashimi_nigiri_opening_mic`.

# Dra. Delian Loyola · Reedición «más profesionales» (2026-09-23)
- Perfil actual `styles/delian-reference-v6-shoika.json`: Shoika SemiBold original (ASS72), texto blanco y sombra violeta desplazada; cotejado con Publicados 14 agosto. Archivo local `media/delian/brand/Shoika-SemiBold.otf`, descargado de CapCut con filtro Commercial visible. Montserrat/v5 es histórico; no aplicarlo en nuevas revisiones. Reglas en `styles/delian-feedback.json#professional_edit_rule`. Galería histórica `runs/delian-five.html` desde `runs/delian-five-review.json` (`python3 build_delian_gallery.py`); lote de septiembre `runs/delian-sept-five.html`.
- Encuadre de lo publicado: alternar plano medio y primer plano por frase. `pipeline.py` admite zoom hasta el límite nativo del crudo (`max_zoom_for`: DJI 1728×3072 → 1.6) y `focus_y` por clip (0 arriba, 0.5 centro) para dejar el rostro sobre los captions.
- Whisper estira palabras sobre las pausas: antes de cortar, `python3 scripts/snap_words_to_silence.py MEDIA TRANSCRIPT runs/delian-transcripts/X.json` (copia; nunca pisa el original) y verificar con la envolvente que ningún final quede mordido. v3 de Cinco Opciones mordía «dental» y «laminados».
- Para partir un clip o quitar una pausa sin re-sincronizar captions a mano: `python3 scripts/recut_recipe.py SPEC.json` (proyecta captions/B-roll/sonidos por tiempo del original). Placas: `python3 scripts/delian_plates.py SALIDA.png "LÍNEA 1" "LÍNEA 2"`.
- `wrap_balanced` (global, todos los clientes): un número de lista («3.») nunca queda solo en su línea; se une a la palabra siguiente.
- Audio Kit recorta la cola que añade `loudnorm` dinámico (LRA > 7); ya no falla «La duración cambió más de 60 ms».

## Delian · Transiciones, B-roll E Imágenes (2026-09-23)
- Eric requiere efectos visuales en las transiciones, sonidos sincronizados, B-roll de video e imágenes de apoyo, y música de fondo. Fuente de parámetros y alcance: `styles/delian-feedback.json#transition_broll_music_request`. Aplicar a las revisiones del lote de septiembre y conservar las demostraciones útiles. La corrección más reciente pide quitar el rótulo «Imagen ilustrativa»; registrar procedencia fuera de pantalla, sin presentar ilustraciones como pacientes reales.

## Delian · Música Y Clicks (2026-09-23)
- Eric rechazó la música triste: usar una pista alegre y ligera. En Diseño de Sonrisa v7 se usa Funshine (CC0 documentado) con continuidad hasta el cierre.
- Los sonidos de transición deben ser clicks breves y secos. Sustituir swipes/whooshes; sincronizar al cambio visual, un solo click al entrar al outro. Parámetros y alcance en `styles/delian-feedback.json#audio_feedback`.

## Delian · Idea Hecha, No Reeditar (Eric 2026-09-23)
- «¿Qué Es Un Diseño De Sonrisa?» (`diseno-sonrisa-20260921`) está HECHA en v7. Consultar `runs/delian-sept-catalog.json`: `editing_completed=true`, `do_not_reedit=true`. Excluirla de propuestas, lotes y pendientes de edición; no volver a renderizar automáticamente. La tarea #3 está ABIERTA para VERIFICAR v7 (ver/escuchar y registrar resultado), y debe aparecer cuando Nathan pregunte por sus tareas. Verificar no equivale a reeditar. No afecta a las otras ideas de Delian.

## Delian · Proceso De Sonrisa: B-roll Y Keyframes (Eric 2026-09-23)
- Para `proceso-sonrisa-20260921`, quitar el rótulo «Imagen ilustrativa» por petición explícita de Eric; esta corrección sustituye el rótulo requerido anteriormente para este video. Mantener procedencia de imágenes en la receta y catálogo. Reemplazar el encerado de v5, rechazado por su apariencia, y añadir movimientos suaves y visibles mediante keyframes sin tapar ni recortar gestos relevantes.

- Proceso de Sonrisa: Eric también pide más B-rolls. Aumentar variedad y cobertura vinculadas a cada frase; preservar la demostración de la doctora y registrar apoyos reales frente a imágenes editoriales generadas.

## Cierre De Compartir · Yabuuchi (Eric 2026-09-23)
- El Mejor Sushi Para Compartir debe cerrar con la invitación original de La Baby Para Dos: «Y si aún no lo has probado» y dirección completa, antes del outro. Usar 0002 sin conteo previo; conservar el video La Baby independiente. Receta v4 y `styles/yabuuchi-feedback.json#compartir_closing_request`.

## Transiciones De Compartir · Yabuuchi
- Eric pide clicks breves y cortes más fluidos en El Mejor Sushi Para Compartir. Sustituir whooshes y barridos bruscos por clicks sincronizados y empalmes discretos. Alcance específico de este reel; receta v5.

## Música Única Por Reel · Eric 2026-09-24
- Cada reel nuevo debe usar una canción distinta, sin reutilizar pistas entre reels. Cambiar el punto de inicio, recortar o renombrar una pista NO la convierte en otra canción. Esta regla sustituye permisos anteriores de reutilización musical.
- Consultar styles/music-usage.json y las recetas antes de seleccionar; registrar título, fuente, hash y reel. Variantes de un mismo reel pueden conservar su pista salvo nueva corrección del usuario. Respetar tono del cliente, licencia, voz y clicks. No modificar automáticamente entregas hechas o publicadas.

## Delian · Cortes Limpios De B-roll
- Eric rechaza la transparencia de la doctora entre apoyos. Usar cortes directos opacos entre B-rolls y plano principal; sin fundidos alfa ni blur en estos empalmes. Conservar clicks y keyframes. Revisar fotogramas contiguos y evitar huecos que revelen el plano inferior.

- Proceso de Sonrisa: Eric especificó música moderna estilo rap mexicano. City Sunshine fue rechazada por no encajar; priorizar instrumental de ese género con voz clara, no sustituir por pop alegre o música de meditación. Mantener pista única por reel.

- Seguimiento de Eric: «pon cualquier otra que tú entiendas». Autoriza escoger otra instrumental disponible para Proceso de Sonrisa, manteniendo pista no repetida, voz clara, clicks y cortes limpios.

## La Baby Sin Invitación Repetida · Eric 2026-09-23
- Retirar de La Baby Para Dos la invitación «Y si aún no lo has probado» y la dirección, porque ya cierran El Mejor Sushi Para Compartir v5. Conservar apertura, explicación para dos personas, producto y logo. Esta corrección sustituye la exigencia anterior de conservar la invitación en La Baby. Receta v13.

## Cierre De Churrasco Roll · Eric 2026-09-23
- Así Se Prepara El Churrasco Roll: después de la entrega completa, mostrar 3.3 s del roll terminado (0991, ángulo alto) antes del logo. Toma elegida por Eric. Conservar preparación y voz. Base Recibo v8, revisión v9.

## Arranque De La Baby · Eric 2026-09-23
- Eric reporta un ruido/golpe al inicio de v13. Revisar el arranque sin morder «Si tienes hambre». Eric precisa 0:00–0:01 y describe roce de micrófono o viento; v16 aplica control localizado de graves y ruido, con recuperación gradual del ambiente inicial. Confirmación auditiva pendiente, no asumir eliminación del ruido por control técnico.

## Delian · Control De Crudos Usados · 2026-09-24
Antes de seleccionar otra edición del 21 de septiembre, leer `runs/delian-sept-usados.md` y `runs/delian-sept-source-usage.json`. No proponer como nuevos los cuatro reels entregados. Limpieza queda usada en borrador y en pausa editorial. Agrupar introducciones, partes numeradas y cierres; distinguir uso parcial como B-roll de reel principal editado. Los 36 archivos ya están disponibles; 164420 es prevención de caries y 170626 gingivitis. Gingivitis ya tiene borrador v1; no proponerlo como nuevo.

## Ideas De Referencia · Yabuuchi (Eric 2026-09-24)
- Usar Content Ideas-Yabuuchi (1).pdf como referencia de conceptos. Salmón Tempura adapta la idea de opciones sin pescado crudo de la página 1 con el diálogo real de 0339. No confundir propuestas del PDF con escenas efectivamente grabadas.

## Final Del Sketch De Palillos · Eric 2026-09-24
- El v1 termina demasiado de repente. Dejar terminar la reacción antes del logo y bajar la música progresivamente. v2 extiende 2.7s y añade salida suave; no congelar ni cortar el remate.

## Comprobar Publicación Antes De Editar · Eric 2026-09-24
- Antes de proponer, seleccionar o editar un video, comprobar publicaciones reales y programación en Metricool y los enlaces de redes disponibles. Comparar idea, diálogo y escenas, no solo título o nombre de archivo. Registrar fecha, rango revisado, enlace y resultado. Recibo, R2 y falta de receta no prueban que no esté publicado. Si la comprobación es incompleta, marcar publicación no verificada y no ofrecerlo como inédito.

## Delian · Apoyos Creativos Sin Reutilización · Eric 2026-09-24
- No reutilizar B-roll de otros reels de Delian, aunque cambien recorte o keyframes. Esta corrección sustituye el alcance anterior limitado a repeticiones dentro de un video. Consultar `styles/delian-feedback.json#creative_broll_no_reuse` y `media/delian/broll-index.json`.
- Para conceptos, crear ilustraciones educativas 3D, motion graphics o usar nuevas imágenes con licencia. Cada recurso queda reservado a un reel; variantes del mismo reel pueden conservarlo. Mantener captions publicados, clicks y cortes opacos. Documentar procedencia fuera de pantalla.

## Uso De AI Y Recursos · Eric 2026-09-26
- Priorizar trabajo local y reutilizable. AI del agente solo para decisiones editoriales, ambigüedades del diálogo o recursos que no resuelvan el material y las plantillas existentes. No generar imágenes/videos ni repetir análisis visuales completos por defecto.
- Antes de inferir, consultar perfil, catálogo, transcripción y receta actuales. Leer ventanas del diálogo con `editkit.py window`; revisar cambios concretos sin volver a enviar todo el material al agente. Mantener revisión final visual y escucha completa.
- Transcripción habitual por `pipeline.py transcribe` / `local_transcription.py`: Whisper local, caché por contenido, modelo, versión del motor y vocabulario. Mantener `base` como valor existente del CLI y `small` en los lotes que ya lo usaban; no subir a turbo ni hacer una segunda pasada completa sin un problema concreto.
- Conservar transcripciones corregidas. Una transcripción antigua sin procedencia no se sobrescribe: usarla desde la receta o crear otro nombre si hay razón para retranscribir. La caché guarda la inferencia original, no propaga correcciones editoriales entre archivos.
- Cortes, sincronización, captions, motion graphics, sonidos, mezcla, mediciones y render se ejecutan con los kits locales. Agrupar cambios editoriales antes del siguiente render; no ejecutar renders pesados simultáneos. El bloqueo de transcripción solo cubre las llamadas al helper compartido, no scripts históricos con Whisper directo.
- Revisar espacio antes de cada lote. Preferir salida en SSD externo cuando esté montado y tenga espacio; pasar su ruta como salida a `pipeline.py render`. No mover ni borrar originales, exports, referencias o intermedios anteriores automáticamente. Ver `RESOURCE-AUDIT.md` para alcance y limitaciones.

## Lotes De Edición · Entrada Predeterminada Del Agente
Cuando Eric pida uno o varios videos de un cliente, usar `pipeline.py batch` como
coordinador. No reconstruir el flujo con scripts particulares por video.

1. `start CLIENT --count N --prompt "solicitud completa" --folder RUTA`: crea
   contexto común con instrucciones globales y del cliente, feedback, estilo
   vigente, catálogo, fuentes locales, transcripciones y versiones existentes.
   Leer `context.json` una vez para el lote. No volver a releer perfiles por video.
2. Consultar los índices relevantes de B-roll/música una vez y comprobar
   publicación/uso de las ideas. Seleccionar las N piezas juntas en `selection.json`.
   `select RUTA selection.json` y `prepare RUTA` reutilizan las transcripciones;
   solo las faltantes usan Whisper local. Leer `prepared.json`; consultar palabras
   exactas por ventana únicamente donde se vayan a fijar cortes.
3. Ver las muestras visuales necesarias. Tomar las decisiones editoriales de los
   N videos juntas en `decisions.json`: clips, B-roll con motivo, captions cuando
   necesiten corrección, música/efectos y nota editorial. `compose` genera todas
   las recetas y captions locales, hereda perfil/outro y valida antes de escribir.
4. `run RUTA` ejecuta en secuencia, guarda avance por video y genera `review.html`.
   Un fallo se informa y permite continuar con los otros. Repetir `run` omite los
   exports cuyas entradas y controles siguen válidos. No lanzar AI para vigilar
   cada paso: esperar el proceso local y leer el resumen al terminar.
5. Revisar todos los exports hasta el outro y escuchar la mezcla. Para corregir,
   enviar a `compose` solo los IDs afectados y sus decisiones completas; crea
   versiones nuevas. Reutilizar el contexto del lote y las decisiones de los demás.
   No confundir controles técnicos con aprobación editorial, auditiva o del cliente.
6. Si cambian instrucciones, `refresh` reúne el nuevo contexto. Leer los cambios y
   renovar mediante `compose` los planes que se vayan a ejecutar. No usar un plan
   anterior silenciosamente. El registro de `current_style` del feedback prevalece
   sobre el estilo histórico del registro de clientes.

Guía y formatos: `BATCH.md`. El prompt lo interpreta el agente de esta conversación;
el coordinador no llama a un LLM, no descarga originales ni inventa decisiones.
La cantidad de llamadas del agente depende de las excepciones y la revisión;
no prometer una cifra fija. Un solo prompt del usuario debe bastar cuando estén
identificados el cliente, las piezas/material y las instrucciones necesarias.

## Delian · Indicaciones Animadas · Eric 2026-09-26
- En apoyos conceptuales, añadir flechas o gráficas animadas que señalen lo narrado, sincronizadas a la voz y siguiendo los keyframes. Mantener subtítulos y rostros legibles; no inventar diagnósticos ni mediciones. Parámetros y alcance: `styles/delian-feedback.json#explanatory_motion_graphics`.

## Caption Sin Perfil · Buscar En Metricool (Eric)
- Si no existe el perfil/archivo de estilo de captions del cliente, buscar primero
  sus videos realmente publicados en Metricool. La falta del archivo inicia la
  búsqueda; no sustituirlo por un estilo genérico ni por otro cliente.
- `pipeline.py batch start` devuelve `needs_style_reference` y consulta publicaciones
  del cliente mediante el conector local, sin escribir en Metricool. Guarda el
  resultado en `style-request.json` y `metricool/report.json` dentro del lote.
- Revisar hasta tres videos recientes y distintos con captions visibles; las hojas
  locales se obtienen con el `frames_command` del resultado. El texto del post no
  determina la tipografía ni el tratamiento de subtítulos dentro del video.
- Identificar tipografía (o dejar explícito si solo es aproximada), tamaño,
  colores, borde/sombra/fondo, posición, mayúsculas, agrupación y animación.
  Si las muestras discrepan, revisar fechas y las correcciones explícitas de Eric;
  no mezclar estilos ni afirmar identidad de fuente sin evidencia.
- Guardar el estilo en `styles/`, vincularlo al registro del cliente y conservar
  enlaces/fechas/fotogramas de referencia. No copiar defaults como si estuvieran
  observados. Conservar las correcciones expresas de Eric que ya estén vigentes.
- Repetir `start` en la misma carpeta tras crear el perfil; reutilizarlo en futuros
  lotes. La búsqueda se guarda una vez por lote. Si falló el acceso, usar otra
  carpeta de búsqueda o consultar con acceso verificado sin repetir a ciegas.
- Solo dejar pendiente por falta de referencia después de buscar y confirmar que
  no hay videos utilizables o que el acceso no está disponible. La inferencia
  visual del agente sigue siendo necesaria; el programa no inventa el estilo.


## Regla Global · Ficha De Captions Para Cada Cliente

- Aplicar `CAPTIONS-POR-CLIENTE.md` a todos los editores, humanos o agentes. Usar el mismo tratamiento visual ya utilizado para ese cliente, con la corrección expresa más reciente como autoridad.
- Cada cliente debe tener una ficha `editor_guide` en `styles/clients.json`, referencias anteriores con procedencia, fuente original, parámetros completos y pendientes explícitos. Leer la ficha, el perfil vigente y el feedback antes de editar.
- Si falta información, recuperarla del Brand Kit de Drive o los videos del mismo cliente; no inventar estilos ni usar los de otro. Las aproximaciones deben estar identificadas.
- Actualizar ficha, perfil, feedback y evidencia juntos en cada corrección. Borrador, aprobación y publicación siguen siendo estados distintos.

## Motion Array · Biblioteca Global En SSD (Eric 2026-09-27)
- Flujo obligatorio para todos los clientes: `docs/MOTION-ARRAY-LIBRARY.md`; catálogo `/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array/catalogo.json`; utilidad `scripts/motion_array_library.py`.
- Buscar antes de descargar, usar recursos descargados reales y registrar selección/descargando/verificado/uso con procedencia y licencia. Cada uso conserva cliente, reel, versión, frase, tiempo y variante/hash. Comunicar el progreso real.
- Efectos reutilizables por sentido de escena; no duplicar archivos ya disponibles. Respetar música única por reel y conservar los descartes como feedback de esa escena.

## Delian · Diseño De Sonrisa Apertura (Eric 2026-09-30)
- Eric autoriza explícitamente revisar la apertura de v7: más rostro y menos cuerpo completo. Esta solicitud sustituye la prohibición de reeditar solo para esta revisión v8; conservar el resto del montaje y versiones anteriores. Parámetros en `styles/delian-feedback.json#diseno_opening_face_crop`.

## Delian · Oye Doctora Apertura (Eric 2026-09-30)
- Conservar Diseño de sonrisa v8. Aplicar encuadre de rostro y parte superior del cuerpo a la apertura «Oye, doctora» de `sonrisas-iguales-20260921`; conservar mosaico y resto del montaje. Feedback específico en `styles/delian-feedback.json#iguales_opening_face_crop`.

## Graph Engineering Loop · Eric 2026-10-01
Siempre pasar cada video por un ciclo de revisión: idea/fuentes → cortes, continuidad y keyframes → captions del cliente → B-roll pertinente → efectos y música → render → revisión visual, reproducción completa y escucha crítica → corregir y repetir en otra versión. Registrar hallazgos concretos y evidencia; mantener pendientes los controles no realizados. Conservar versiones y separar aprobación de subida a Recibo.

## Búsqueda doble e ideas existentes en los videos · Eric 2026-10-02

- Regla global para todos los clientes: si la primera búsqueda no encuentra más videos editables, realizar una segunda búsqueda antes de concluir que no quedan videos. Revisar nuevamente Drive, dashboard y SSD, incluyendo otras carpetas, tomas, continuaciones y remates; contrastar con las ediciones y usos existentes. No limitar la segunda búsqueda a repetir la misma lista o asumir contenido por el nombre del archivo.
- Documentar las dos pasadas, fuentes revisadas y cualquier fuente inaccesible o material sin revisar. Si no hay certeza, decirle expresamente a Eric que no se puede confirmar que no queden videos, explicar qué falta comprobar y no afirmar que se agotó el material.
- La idea de cada edición debe estar ya presente en el contenido grabado. Identificar el archivo y los tramos que la sustentan. Un título o idea del dashboard sin respaldo en las grabaciones no basta.
- No inventar ideas nuevas, reinterpretar tomas ajenas como una nueva idea ni llenar la falta de material con propuestas creativas, salvo petición expresa de Eric. Se permite editar y condensar una idea grabada conservando su sentido.
