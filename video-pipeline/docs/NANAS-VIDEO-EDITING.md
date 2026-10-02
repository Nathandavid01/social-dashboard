# Nana’s Playhouse · Instrucciones Portables Para Editar Videos Con IA

Actualizado: 15 de septiembre de 2026.

## Cómo Usar Esta Guía Con Otra Cuenta O Modelo

Comparte el enlace de este archivo y el siguiente mensaje:

> Lee esta guía y continúa el pipeline de Nana’s Playhouse. Localiza la carpeta video-pipeline y lee sus reglas, perfiles, feedback y catálogo actualizado. Identifica la versión vigente del video que te pida editar. Crea una receta nueva, aplica los cambios, renderiza y comprueba el resultado completo hasta el outro. Actualiza la galería, los usos de B-roll y las reglas reutilizables. Conserva los originales y versiones anteriores. Si falta acceso al proyecto o al material, explica exactamente qué falta; no inventes haber editado o verificado el video.

Añade el título del video y el cambio deseado. Por ejemplo:

> Edita «Tres Cosas Menos De Qué Preocuparte»: mejora la apertura y conserva los tres clicks de la enumeración.

**Este documento se puede leer con el enlace, sin usar la misma cuenta de GitHub.** El modelo debe poder abrir enlaces o recibir el texto copiado. Una conversación nueva no descubre esta guía automáticamente: comparte su enlace al iniciar.

**La guía no contiene el programa ni los videos.** Para editar y exportar, el modelo necesita acceso al proyecto completo, sus dependencias y los archivos de medios. Un modelo que solo recibe texto puede proponer cambios en las recetas, pero no renderizar sin herramientas de ejecución.

## Proyecto Y Archivos Que Deben Estar Disponibles

Trabajar desde la raíz de `video-pipeline`. En otro equipo, el usuario puede guardar esa carpeta en una ubicación distinta. Resolver las rutas desde el proyecto; no depender de un nombre de usuario del sistema.

| Archivo O Carpeta | Uso |
| --- | --- |
| `AGENTS.md` | Reglas vigentes del cliente y procedimiento de revisión |
| `styles/nanas-quartzo.json` | Tipografía y captions |
| `styles/nanas-audio.json` | Mezcla, clicks y preferencias musicales |
| `styles/nanas-feedback.json` | Correcciones específicas por video |
| `styles/nanas-broll-reservations.json` | Reservas de tomas entre videos del lote |
| `runs/catalog.json` | Ideas y material vinculado |
| `runs/catalog-reedit-items.json` | Versiones actuales de los ocho reels |
| `runs/nanas-batch-manifest.json` | Resultados actuales de la galería |
| `media/broll-index.json` y `media/BROLL-NANAS.md` | Contenido, rangos y usos de B-roll |
| `edits/` | Recetas de montaje reproducibles en JSON |
| `media/` | Originales, B-roll, fuentes, logos, música y outro |
| `runs/` | Transcripciones, MP4 exportados y evidencia de revisión |
| `pipeline.py` y `review_loop.py` | Renderizado y grafo de revisión |
| `effectkit.py`, `effects.py`, `EFFECTS.md` | Sonidos y transiciones reutilizables |
| `motion_cards.py` | Gráficas de listas animadas |

Los archivos locales vigentes y las correcciones nuevas del usuario prevalecen sobre esta copia fechada. El README incluye decisiones históricas; no restaurar un estilo antiguo por leerlo fuera de contexto.

## Reglas De Edición De Nana’s

### Idea Y Ritmo

- Conservar el sentido y las palabras de la grabación. La idea del dashboard orienta; no añadir voz ni afirmaciones que no estén grabadas.
- Crear una apertura clara y atractiva. Cubrir gestos de preparación o una expresión incongruente con una gráfica breve cuando sea necesario.
- Mantener frases y pausas naturales. No cortar sílabas ni introducir regresos al presentador de unos pocos fotogramas entre B-rolls.
- Aplicar zooms con keyframes suaves. Evitar flashes, zooms y whooshes excesivos. No garantizar resultados virales.

### Captions Y Marca

- Captions **QUARTZO demo Bold, 85 px**, blancos con borde magenta, sobre exportación de **1080 × 1920**. Leer el perfil vigente para posición, borde y sombra.
- Conservar el tamaño: dividir frases o líneas antes que reducir automáticamente la fuente. Verificar el ASS exportado y la imagen final.
- Escribir **Nana’s Playhouse** completo cuando se identifica el negocio.
- Si la fuente demo dibuja mal los dígitos, usar Arial Bold a los mismos 85 px para teléfonos y números de captions. Los números decorativos de una gráfica pueden tener su propia jerarquía.
- Usar el logo oficial completo; comprobar límites de transparencia para no recortar «Playhouse».
- El archivo QUARTZO suministrado está marcado Personal Use Only: comprobar la licencia antes de declarar el material listo para publicación comercial.

### B-roll

- Cada toma debe ilustrar la frase que se escucha. Una piscina de bolas no explica cualquier tema; jugar con bloques no equivale a limpiar.
- Priorizar fuentes sin uso anterior y después las menos usadas, siempre que sean pertinentes.
- No repetir una toma dentro del reel. Consultar las reservas para mantener cada fuente de apoyo en un solo video del lote actual.
- Comparar hashes y familias de escenas: cambiar el rango, recorte o nombre no convierte el material en una toma nueva.
- Evitar el niño en el trampolín como recurso genérico; fue usado en exceso.
- Mostrar acciones naturales; excluir rangos con personas leyendo el guion o presentando a cámara. No ocultarlo mediante recortes extraños.
- Revisar el rango exacto, movimiento y encuadre; los rangos del catálogo son sugerencias. Silenciar el audio original del B-roll.
- Cuando falte una toma pertinente, conservar al presentador o usar una ilustración claramente gráfica del concepto.
- En clips compuestos, guardar `original_source`, `source_in` y `source_out`; las gráficas puras usan `kind: brand_graphic`. El catálogo debe seguir contando la fuente real.

### Música, Ambiente Y Efectos

- Voz al frente: objetivo inicial **−16 LUFS**. Música: objetivo inicial **−27 LUFS**. Usar el procesamiento de ambiente del perfil y ajustar por escucha.
- Los valores numéricos no sustituyen escuchar la mezcla. No afirmar que se escuchó si solo se analizó con herramientas.
- Variar estilos musicales entre reels. Evitar comienzos musicales silenciosos y conservar evidencia de licencia y procedencia.
- Usar música con licencia que cubra el uso previsto, sin atribución obligatoria según la preferencia del cliente; priorizar CC0. No asumir que una pista sirve comercialmente solo por estar en CapCut.
- «Lovely Piano Song» fue rechazada para el video dirigido a padres; no restaurarla automáticamente.
- En listas, un **click mecánico fuerte por punto**, al inicio de la frase y del número. Preset actual: mouse/click, 0.09 s, ganancia −12 dB; verificar el perfil vigente.
- Los whooshes suaves acompañan cambios reales. No acumular click y whoosh en el mismo instante sin una razón editorial.

### Gráficas Y Outro

- En listas, número visible desde el inicio, jerarquía clara por punto e iconos con entradas suaves.
- Las gráficas deben coincidir con la voz: limpieza para «limpiar», casa para «prestar tu casa», teléfono cuando se dicta, redes cuando se mencionan.
- Separar logo, números, caras y captions. No colocar horarios en una pieza que no habla de horarios.
- Para reglas, demostrar acciones correctas. Si se muestra un objeto prohibido, señalar explícitamente la prohibición; no afirmar detalles que no se ven.
- Usar `media/brand/outro-with-star-sfx.mov`, ganancia 1: efecto de estrella/caída y cola hasta terminar. No duplicar el efecto sobre ese archivo ya sonorizado.
- Comprobar que el montaje no regrese al inicio antes del outro.

## Procedimiento Por Edición

1. Leer reglas, perfiles, feedback, idea y versiones actuales. No adivinar la versión por el nombre de una pestaña abierta.
2. Revisar la receta vigente, la narración y los defectos señalados por el usuario.
3. Buscar B-roll por tema y consultar reservas; inspeccionar únicamente los rangos nuevos o dudosos.
4. Preparar un plan de planos y una receta nueva. Reutilizar música, mezcla o gráficos que no requieran cambios.
5. Renderizar un MP4 con número de versión nuevo. Nunca sobrescribir originales ni exportaciones anteriores.
6. Completar el ciclo: **idea → referencias → montaje → control técnico → revisión visual → escucha → revisión del usuario**. Si se encuentra un defecto, corregir en otra versión y revisar de nuevo.
7. Comparar con las referencias locales de Instagram, el ejemplo de marca y la versión anterior. Registrar hallazgos reales en `.review.json`; no inventar puntuaciones de similitud.
8. Verificar formato, captions, sincronización, repetición de tomas, decodificación completa y reproducción hasta el último fotograma del outro.
9. Actualizar la versión vigente, galería, catálogo y reservas. Separar lo verificado de la escucha o aprobación pendiente.
10. Convertir cada corrección reutilizable en una regla: general en `AGENTS.md`, audio en su perfil, decisión particular en feedback y usos/defectos de tomas en el catálogo. No confundir ausencia de respuesta con aprobación.

El grafo es un ciclo por edición; no es un monitor programado. La exportación local no equivale a publicación en redes.

Render externo al pipeline (p. ej. solo cambio de outro sobre un editado ya entregado): escribir junto al MP4 el mismo informe `.json` que genera `pipeline.py` (`edit` con `idea_id`, `catalog` y `references` explícitas; `verification` con decodificación completa real) y llamar a `review_loop.build`. Si la versión no quema captions propios, el `style` no declara `font_file` y el grafo no exige fuente (2026-09-29). Ejemplo: `runs/apiario-countdown-outro/report.py`.

## Comandos Del Proyecto

Ejecutarlos desde `video-pipeline`. Los nombres `VIDEO` y `NUEVA` son marcadores que deben sustituirse por el slug y una versión que no exista.

```sh
# Buscar material pertinente.
python3 broll_library.py --search "juegos"

# Consultar presets antes de crear efectos nuevos.
python3 effectkit.py list

# Renderizar una receta nueva ya preparada.
python3 pipeline.py render edits/VIDEO-vNUEVA.json runs/nanas-VIDEO-vNUEVA.mp4

# Tras verificar el resultado y actualizar runs/catalog-reedit-items.json:
python3 review_pending.py
python3 broll_library.py
python3 audit_nanas_broll.py

# Abrir el servidor local si no está ejecutándose.
python3 serve.py
```

Galería: `http://127.0.0.1:3046/nanas.html`.
Biblioteca: `http://127.0.0.1:3046/broll-catalog/index.html`.
Efectos: `http://127.0.0.1:3046/effects/index.html`.
Estas direcciones funcionan en el equipo donde corre el servidor; no dan acceso remoto al proyecto.

Para gráficas, consultar `motion_cards.py` y una especificación existente. Crear una copia con nombres de salida nuevos antes de ejecutarla; las herramientas rechazan sobrescrituras.

## Preparación En Otro Equipo

- Copiar el proyecto, sus recetas y los medios necesarios por un canal autorizado. Este Gist contiene únicamente instrucciones.
- Verificar Python, Pillow, NumPy/SciPy y FFmpeg con `libass`, además de `ffprobe`. Para nuevas transcripciones, instalar las dependencias de Whisper/PyTorch; para consultar el dashboard, revisar las dependencias de Node del proyecto.
- Algunos scripts existentes tienen rutas de FFmpeg o fuentes específicas de macOS: verificar y adaptar esas rutas antes del primer render en otro equipo.
- Configurar el acceso al dashboard/Drive de forma privada cuando sea necesario; nunca pegar credenciales en esta guía.
- Usar primero una receta de prueba con nombre nuevo y comprobar la exportación antes de procesar un lote.

## Mantener Esta Guía Vigente

Actualizar las reglas locales después de cada corrección. Para trasladar nuevas reglas entre cuentas, actualizar también este mismo Gist cuando el usuario lo solicite y la sesión tenga acceso de escritura a la cuenta propietaria. Leer el enlace no concede permisos de escritura ni acceso al dashboard o a los medios. Conservar el enlace estable para seguir compartiéndolo.
