# Captions Por Cliente · Guía Para Cualquier Editor

## Regla Global

Usar los mismos captions visuales que ya se han utilizado para el cliente. Esta regla aplica a editores humanos, agentes y cualquier aplicación. El texto se sincroniza con el diálogo de cada video; se reutiliza el tratamiento visual, no frases ajenas a la grabación.

Antes de editar, abrir la ficha del cliente y sus referencias. La instrucción expresa más reciente de Eric prevalece. No mezclar estilos entre clientes ni interpretar una exportación local como aprobación.

Pregunta detrás de cámara (Eric 2026-10-02, todos los clientes): esa tarjeta lleva `behind_camera: true` y el renderer invierte texto y caja, o texto y borde si el cliente no usa caja. La respuesta y la pregunta a cámara no llevan la marca. Un `?` en el texto no invierte solo. Los colores de la receta siguen siendo los del cliente.

## Información Obligatoria En Cada Ficha

- Nombre del cliente y perfil vigente, con versión.
- Ejemplos ya utilizados/publicados o referencia expresamente indicada: enlace o archivo, procedencia y estado de verificación.
- Fuente original y peso; archivo o ubicación compartida. Señalar cualquier aproximación.
- Tamaño y resolución de diseño, color, fondo, borde, sombra y opacidad.
- Posición, márgenes, alineación, cantidad de líneas/palabras, mayúsculas y animación.
- Correcciones vigentes, fecha, estado de aprobación y datos pendientes.

Si falta un dato, buscar primero el Brand Kit de Drive y los videos anteriores del cliente; consultar publicaciones de Metricool cuando corresponda. No completar con defaults de otro cliente. Si sigue sin verificarse, marcarlo como pendiente antes de usarlo como referencia.

## Fichas Disponibles

- [Nana’s Playhouse](styles/editor-guides/nanas.md)
- [Arecibo Lab](styles/editor-guides/arecibo.md)
- [Yabuuchi Sushi](styles/editor-guides/yabuuchi.md)
- [El Truco de Guin](styles/editor-guides/truco.md)
- [Los Cheesys](styles/editor-guides/cheesys.md)
- [Dra. Delian Loyola](styles/editor-guides/delian.md)
- [Farmacia Buena Vida](styles/editor-guides/farmacia-buena-vida.md)

- [La Mía Pizza](styles/editor-guides/mia-pizzeria.md)

## Uso Y Mantenimiento

Las fichas apuntan al JSON vigente y al feedback, que son la fuente de los parámetros. `current_style` del feedback prevalece sobre el registro histórico. Los valores numéricos se consultan en ese perfil para evitar copias desactualizadas; las notas de conversión entre aplicaciones no cambian el diseño del cliente.

Cada cliente nuevo debe tener `editor_guide` en `styles/clients.json` y completar la información anterior. Al cambiar el estilo, actualizar su perfil, evidencia, feedback y ficha juntos. No sustituir una fuente ni modificar tamaño/color/animación por preferencia del editor.

Este paquete está en el espacio local de Nate Media. Los enlaces de Drive disponibles permiten acceder a los originales; los archivos locales requieren acceso al espacio compartido o al SSD indicado. No se ha distribuido este paquete automáticamente a otros editores.

## Variantes Dentro Del Mismo Cliente

Consultar la ficha vigente antes de elegir captions. Farmacia Buena Vida: POV usa v5 con caja oliva; los otros formatos mantienen v7, según corrección de Eric del 2026-09-30.

## Farmacia Buena Vida · Unificación 2026-09-27

Corrección 2026-09-30: POV usa `styles/farmacia-buena-vida-v5.json` (Montserrat SemiBold65 blanco con caja oliva redondeada). Los demás formatos mantienen v7 sin caja. Consultar la ficha vigente antes de editar.

- [Frida Food & Bar](styles/editor-guides/frida.md)

- [Drop Coffee](styles/editor-guides/drop-coffee.md) — evidencia parcial; fuente pendiente.

- [Alacena](styles/editor-guides/alacena.md) — Belleza Regular, blanco con sombra verde oscura, identificado comparando A1/A3/A4.

- [Black Pepper](styles/editor-guides/black-pepper.md) — reconstrucción provisional; fuente exacta pendiente.

- [Mondays Aguadilla](styles/editor-guides/mondays-aguadilla.md) — **siempre una sola línea** (Eric2026-10-02), frases cortas sin reducir tamaño; perfil v3. Procedencia de fuente oficial pendiente.

- [Apiario Coffee](styles/editor-guides/apiario.md) — countdown observado; identidad exacta de la fuente de captions pendiente.

## Guías de videos e imágenes por cliente · 2026-10-02

Antes de trabajar videos o imágenes de cualquier cliente, abrir [GUIAS-POR-CLIENTE.md](</Users/ericperez/Nate Media/video-pipeline/GUIAS-POR-CLIENTE.md>) y su ficha individual. El índice completo está en `video-pipeline/styles/client-guides.json` (ruta desde Nate Media); incluye fichas base sin perfil confirmado. Preservar parámetros y correcciones existentes, documentar faltantes y actualizar la ficha con cada corrección confirmada, indicando fecha y alcance. No mezclar estilos ni convertir entrega en aprobación/publicación.

## Fondos de overlays · Eric2026-10-02

Usar siempre colores de la paleta confirmada de cada cliente para los backgrounds de overlays. No trasladar colores entre clientes. La selección expresa más reciente prevalece; Apiario: amarillo #CB9907 para el estilo de overlay rectangular de preparación. Guardar la regla y el perfil por cliente, conservando versiones anteriores.
