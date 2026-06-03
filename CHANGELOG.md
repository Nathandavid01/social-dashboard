# Changelog

Novedades del dashboard de Nate Media. Cada entrada resume lo que cambió en un commit.

> Versionado: cada merge a `main` sube la versión. Una **feature grande** sube el número grande (1.x → 2.0); una **feature pequeña o fix** sube el número pequeño (1.4 → 1.5).

## v2.6 — 2026-06-03

### Fix de build (deploy en Vercel)
- El `Topbar` no reenviaba `notifications`/`unreadCount` a la campana de notificaciones, lo que **rompía el build de producción** (`next build` falla con errores de tipo). Corregido: ahora el build pasa verde y la app puede desplegar en Vercel.

## v2.5 — 2026-06-03

### Board Pipeline por BATCHES de cliente (color por persona)
- El board ahora trabaja por **batches de cliente**, no video por video: cuando trabajas un cliente, trabajas **todo su período** (mes / semana / sesión de grabación), así que **todos sus videos viajan juntos** por el pipeline como una sola tarjeta y se mueven en bloque.
- **El color lo define la persona asignada**: cada miembro del equipo tiene su color, y el batch se pinta del color de su responsable — el board se vuelve un mapa visual de **quién tiene qué**.
- **Filtro por persona asignada** (Asignado a: Todos / cada persona) además del filtro por cliente.
- Orden de columnas: **Idea → Title** → Caption → Video → Edited → Approval → Publication.
- Cada tarjeta de batch muestra: cliente, nº de videos del batch, tira de videos, progreso en el pipeline, plataformas y responsable; botones ◀▶ mueven **todo el batch**. Clic abre el cliente.

## v2.4 — 2026-06-03

### Tema oscuro más pulido (toda la app)
- Primer paso del tema global: **bordes más sutiles** y **esquinas más redondeadas** en toda la app, para acercar el acabado al del board Pipeline. (Afecta tarjetas, inputs y contenedores en todas las pantallas.)

## v2.3 — 2026-06-03

### "Nuevo video" desde el board Pipeline
- El botón **Nuevo video** del tablero ahora **crea un video** de verdad: eliges cliente, título y tipo (Reel/Post/Carrusel/Story) y aparece en la primera columna, listo para idear.

## v2.2 — 2026-06-03

### Pulido del board Pipeline
- Las tarjetas muestran ahora los **iconos reales de cada plataforma** (Instagram, TikTok, Facebook, LinkedIn) en vez de texto.
- El encabezado muestra los **avatares del equipo** asignado a los videos del tablero.

## v2.1 — 2026-06-03

### Board global "Pipeline" (estilo Trello, todos los clientes)
- Nueva pantalla **Pipeline** en el menú: **todos los videos de todos los clientes** en un solo tablero estilo Trello, **filtrable por cliente** con chips de color (cada cliente con su número) y búsqueda.
- **7 columnas**: Title → Idea → Caption → Video → Edited → Approval → Publication. Cada tarjeta cae en su columna según dónde va el video.
- **Tarjetas ricas**: color del cliente, miniatura con play, checklist de QC, badge de aprobación/publicación, plataformas, fecha y tags.
- **Mover con botones** ◀ ▶ (aparecen al pasar el mouse) — avanza o retrocede el video al instante.
- **Clic en una tarjeta** abre el panel con la ideación, captions, videos e historial, sin salir del tablero.
- Conteo claro arriba: **videos · publicados · atrasados**.

## v2.0 — 2026-06-03

### Tablero estilo Trello del flujo de cada cliente
- Desde **Workflow**, cada cliente tiene ahora un botón **"Abrir board"** que abre su flujo de producción como un **tablero estilo Trello** con cinco columnas: **Idea → Asignada → Grabada → Producida → Publicada**.
- Cada video/publicación es una **tarjeta** que se **arrastra** de una columna a otra para avanzar el proceso. El cambio se guarda al instante (y se revierte solo si algo falla).
- Soltar una tarjeta en **Publicada** pide **confirmación** (porque registra la fecha de publicación y cuenta para la meta de la semana).
- Al hacer **clic en una tarjeta** se abre un **panel lateral** con toda la información del video sin salir de la pantalla: la **ideación** (hook, brief, ángulo), los **captions por plataforma** (que se generan con IA a partir de esa ideación), los **videos subidos** y el **historial de quién trabajó** con esa tarjeta y cuándo.
- El mismo tablero está disponible también dentro del cliente, en el tab **Flujo**.
- Solo quien tiene permiso de mover (Owner / Supervisor / Editor) puede arrastrar; el resto lo ve en modo lectura.

### Conteo de "publicadas esta semana" corregido
- La meta semanal contaba las publicaciones por la **fecha real de publicación** en vez de la última edición, así que ya no se infla el número cuando se toca un video viejo.

## v1.9 — 2026-05-30

### Color de marca por cliente en Video QC
- Cada **fila de la tabla de videos** lleva ahora un **acento con el color de marca del cliente** (borde izquierdo). Así, en Video QC, las filas de un cliente se distinguen de un vistazo y salta a la vista si una es de otro cliente — refuerza el evitar mezclar contenido entre clientes.

### Video QC como tabla de datos
- La revisión de videos pasó de tarjetas a una **tabla** (Video, Estado, Progreso, Material, Fechas, Acción): más densa y fácil de escanear cuando un cliente tiene muchos videos.

### Subida de varios archivos a la vez
- Ahora puedes **soltar/seleccionar varios videos juntos** en un slot; se suben en lote con su progreso.

### Columna de estado en el plan de 2 semanas
- En el plan semanal de cada cliente, cada fila muestra ahora su **estado** de producción directamente.

### Ideación como filas por cliente
- La pantalla de **Ideación** ahora agrupa las ideas por cliente, cada una con una **barra de estado segmentada** que muestra en qué etapa va cada video (idea → agendada → grabada → producida → publicada). Más fácil ver el estado de todo un cliente de un vistazo.

## v1.8 — 2026-05-29

### Confirmación al aprobar (anti-cliente-equivocado)
- **Aprobar** un video ahora pide una **confirmación** que muestra el **logo y nombre del cliente** + el título: "Verifica que el video sea del cliente correcto". La aprobación solo se aplica tras confirmar — así no se da luz verde al video del cliente equivocado.

## v1.7 — 2026-05-29

### Flujo del cliente como tablero (Kanban)
- La pestaña **Flujo** del cliente pasó de una tabla de checkmarks a un **tablero por etapa**: columnas Idea → Grabado → Editado → Caption → Publicado, con cada video como tarjeta en su etapa actual y el **conteo** por columna.
- Cada tarjeta muestra tipo (Reel/Post…), fecha y **mini-puntos de progreso** de las 5 etapas; al hacer clic abre el detalle del video.
- Los videos **atrasados** se marcan con ⚠ (ámbar): fecha de publicación vencida sin publicar, o más de 7 días sin actividad.

## v1.6 — 2026-05-29

### Aviso cuando llega un video
- Cuando se sube un video **crudo o editado**, le llega una **notificación** (campana) al manager del cliente —o a los owners si el cliente no tiene manager asignado—, con el cliente, el tipo de video y un enlace directo a la idea. La hora del aviso es la hora exacta en que se subió.
- No te avisas a ti mismo de tus propias subidas, y los **b-roll** no generan aviso (para no hacer ruido).

### Hora de subida visible
- Cada video subido ahora muestra **"subido [fecha y hora]"** en el flujo, para saber de un vistazo cuándo llegó.

## v1.5 — 2026-05-29

### Pipeline de videos por cliente (en Video QC)
- Cada cliente aparece con su logo y un **grid de tarjetas de video**: estado, idea, caption, assets compartidos, fechas (grabación/publicación) y **botón de aprobación**.
- Slots de subida a la nube (Cloudflare R2): **4 crudos · 4 b-roll · 2 editados** (mínimos, ampliables).

### Progreso por etapa visible
- El flujo de cada idea muestra el avance por etapa con **conteos** (ej. Material 1/4), una **barra de progreso** con "qué falta", y **chips de etapa** en cada tarjeta de video.

### Logo del cliente y preview de video
- El **logo de la empresa** aparece en cada tarjeta (con iniciales como respaldo).
- Botón **"Ver"** para reproducir el video directamente desde el flujo, sin descargarlo.

### "Planning" ahora es "Workflow"
- Se renombró la sección del sidebar para reflejar que ahí sucede todo el flujo de trabajo.

### Administración de usuarios en Equipo (solo Owner)
- El Owner puede **editar nombre y título**, **activar/desactivar** usuarios (los inactivos no pueden entrar) y cambiar su rol, todo desde la página de Equipo.

## v1.4 — 2026-05-29

### Configurar la cadencia desde Planning
- En cada cliente de Planning puedes tocar los días (Lun–Dom) para fijar su cadencia al instante, incluso si no tenía días configurados. Guarda solo (gateado por `planning.act`).

## v1.3 — 2026-05-29

### Plan de 2 semanas por cliente (toggable) en Planning
- Cada cliente tiene un botón **"Plan 2 sem"** que despliega una tabla con los slots de posteo de las próximas 2 semanas (según su cadencia + cualquier video ya programado).
- Cada slot muestra el día, el tipo (Reel/Post), y la **idea del video** si ya está asignada; los vacíos marcan **"Falta video"**.
- Botón **Caption** por slot que genera el caption a partir de la idea del video (voz de marca del cliente). Requiere `ANTHROPIC_API_KEY`.

## v1.2 — 2026-05-28

### Ritmo semanal con datos reales de Metricool
- El "Esta semana X/Y" de cada cliente en Planning ahora usa los **posts realmente publicados esta semana** (traídos de Metricool, sin drafts ni programados futuros) vs. el target de su cadencia. Verde = al día, ámbar = atrasado. Así se ve de verdad si vamos en ritmo con lo ya posteado.

## v1.1 — 2026-05-28

### Ritmo semanal por cliente en Planning
- Cada cliente en Planning muestra su **pipeline de contenido** (Ideas · Grabar · Editar · Publicar) y el **ritmo de la semana** (posteado / target según su cadencia), con color verde/ámbar para ver de un vistazo quién va al día y quién atrasado.

### Cadencia importada del PRODUCTION CALENDAR
- Se cargó la cadencia real de 31 clientes (`posting_days` + tipo post/reel por día), lo que activa los targets semanales/mensuales en todo el dashboard.

## v1.0 — 2026-05-28

### Flujo de producción por cliente
- Nueva pestaña **Flujo** en el perfil: tabla con un video por fila (con fecha) y una columna por proceso (Idea, Grabado, Editado, Caption, Publicado), con checks de avance.

### Tabla de clientes más limpia
- Se quitó la columna "Asignado a" y las tarjetas de resumen Metricool/Con IA; ahora Metricool e IA son **columnas** de la tabla.

### Versión visible
- La versión de la app se muestra en el sidebar y en Novedades. Cada merge a `main` la sube (grande = feature grande, pequeño = feature chica).

### Banner de planning
- Rediseñado y reescrito ("Prepara la semana"), más claro y menos alarmante.

### Captions dentro del perfil del cliente
- Los captions ahora viven en una pestaña **Captions** dentro de cada cliente; se eliminó la página suelta de Captions.
- Deep-link `?tab=captions` para abrir esa pestaña directamente desde la lista de clientes.

### Workflow: ideación primero
- El primer paso del planning es siempre tener **ideas listas**, al menos un mes por adelantado según la cadencia del cliente.
- Nueva tarjeta **"Producción de esta semana"** en Inicio: muestra cuántos videos están grabados, editados y con captions.
- La tarjeta de pipeline global suma el "faltan por postear esta semana" de todos los clientes (reutilizando el cálculo por cliente).

### Metricool en Configuración
- Metricool se movió a **Ajustes → Metricool** y salió del menú principal (accesible también desde el menú del avatar).
- Los perfiles conectados se sirven desde **Supabase (cache)** y solo se refrescan a demanda, no en cada carga.
- Se corrigieron los nombres de los perfiles conectados.

### Limpieza de interfaz
- **Logo de la compañía** y wordmark **"Nate Media"** en el sidebar.
- Reordenar el menú **arrastrando** (mantén presionado un ítem), sin botón "Editar menú".
- Se quitaron del menú: **Alertas, Operaciones, Captions, Metricool**.
- Columna de **plataformas** con iconos de marca.
- Se quitó el atajo **⌘P** del buscador.
