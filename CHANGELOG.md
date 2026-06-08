# Changelog

Novedades del dashboard de Nate Media. Cada entrada resume lo que cambió en un commit.

> Versionado: cada merge a `main` sube la versión. Una **feature grande** sube el número grande (1.x → 2.0); una **feature pequeña o fix** sube el número pequeño (1.4 → 1.5).

## v2.26 — 2026-06-08

### Fechas límite por video + cuántos videos subió cada persona
- **Fecha límite (deadline) por video:** ahora puedes ponerle una **fecha límite** a cada video (en la tarjeta de "La idea", junto a la fecha de publicación). En el lote aparece un **badge de urgencia**: **Atrasado** (rojo) si la fecha ya pasó, **Pronto** (ámbar) si vence en ≤2 días — y desaparece cuando el video se publica. Las fechas son por día (sin hora) para que no se corran por zona horaria.
- **Videos subidos por persona:** en **Equipo**, cada miembro muestra cuántos videos ha subido, separados en **Raw · B-roll · Editados** (+ total), para ver de un vistazo la producción de cada quien. No requiere migración (usa el `uploaded_by` que ya se guarda en cada archivo).
- **Nota:** la fecha límite necesita la migración `0034_content_idea_deadline.sql` aplicada para poder **guardarse** (ver/leer funciona igual antes). Los conteos de subidas funcionan sin migración.

## v2.25 — 2026-06-08

### Pipeline más claro, asignación por persona, aprobación en el lote y Reels
- **Estado a la vista en el pipeline:** cada tarjeta de cliente muestra ahora su **estado de cuenta** (Activo / Pausado / Onboarding) y un **desglose del estado de sus videos** (cuántos van en Idea, Título, Caption, Video, Edición, Aprobación, Publicación) — todo sin abrir el cliente.
- **"Mis videos":** filtro nuevo en el pipeline para ver de un toque los lotes que tienen algún video asignado a ti. El filtro por persona ahora calza si **cualquiera** de los videos del lote es de esa persona (antes solo miraba al dueño mayoritario). Cada tarjeta de video muestra a quién está asignado y resalta **"Asignado a ti"** cuando te toca.
- **Aprobar dentro del lote:** cuando un video tiene su **versión editada subida**, aparece un botón de **Aprobación** en su tarjeta (para todos los clientes). Aprobar ahí dispara la **auto-publicación a Metricool**, igual que en la tabla de QC.
- **Formato Reel:** si el video es un **Reel** (`content_type = R`), ahora se publica con el **formato Reel** en Instagram y Facebook (TikTok ya es video nativo). Si Metricool rechazara el formato, se reintenta una vez como video normal para que la publicación nunca se rompa.
- **Nota:** la auto-publicación al aprobar requiere la migración `0032_idea_posting.sql` aplicada (ver handoff). Sin ella, la aprobación funciona igual; solo no dispara el post.

## v2.24 — 2026-06-07

### Auto-publicar a Metricool cuando el video está listo
- Cuando un video tiene **caption + título + video editado + aprobado**, ahora se **publica automáticamente en Metricool** al aprobarlo, en su **fecha planificada** (`publish_date` + la hora de posteo del cliente), con el **video adjunto** (URL pública de Cloudflare R2) y las plataformas del cliente.
- También hay un botón **"Publicar a Metricool"** (solo owner/supervisor) en los videos aprobados, por si quieres dispararlo a mano.
- **Seguro por diseño:** idempotente (nunca publica dos veces — guarda el `metricool_post_id`), best-effort (si Metricool falla, la aprobación no se rompe; el error queda registrado), y con un **kill-switch** (`METRICOOL_AUTOPOST_ON_APPROVAL=false`) para desactivar el automático.
- **Requiere aplicar la migración `0032_idea_posting.sql`** a la base de datos antes de funcionar.

## v2.23 — 2026-06-07

### Captions del lote imitan el estilo real del cliente (Metricool)
- Al generar el caption de un video en el lote, ahora se traen los **captions ya publicados del cliente desde Metricool** (por su `metricool_blog_id`) y se usan como **ejemplos de estilo** para que el caption imite su tono, largo, emojis y formato de hashtags — antes solo usaba título + voz de marca.
- Es **best-effort**: si el cliente no tiene Metricool configurado o la API falla, el caption se genera igual (sin ejemplos). La lógica de Metricool se unificó en un solo módulo compartido con la pantalla de Captions.

## v2.22 — 2026-06-07

### Subir el video editado mueve la tarjeta a "Edited"
- Cuando subes el **video editado** de un video, su tarjeta **avanza sola a la columna "Edited"** del Content Pipeline (estado `producida`). Antes solo el video *crudo* movía la tarjeta (a "Video"); subir el editado no la movía y el tablero quedaba desincronizado.
- La promoción **solo avanza**: nunca regresa una tarjeta que ya está aprobada o publicada. El **b-roll** no cambia el estado.

## v2.21 — 2026-06-07

### Content Pipeline: filtro de cliente compacto + arrastrar columnas
- El filtro de clientes pasó de una **fila de chips** (que envolvía y crecía con cada cliente) a un **selector compacto "Cliente"** con buscador, conteo por cliente y botón para limpiar. Libera una fila completa para el tablero y escala a muchos clientes. La línea de stats (*N batches · N publicados*) se movió a la fila de **Asignado a**.
- Ahora puedes **arrastrar el tablero horizontalmente con el mouse** (cursor de mano: agarrar → arrastrando) para moverte entre columnas. Las tarjetas siguen clickeables; un arrastre no abre una tarjeta por accidente.

## v2.20 — 2026-06-04

### Sin el logo de Nate Media entre pantallas
- Se quitó el **splash full-screen con el logo** que aparecía en cada transición de página. Los loadings de ruta ahora no muestran nada bloqueante; la retroalimentación de navegación la da la **barra de progreso superior**. Los loaders en línea usan un spinner neutro y sutil.

## v2.19 — 2026-06-04

### Calendario de Grabación rediseñado (color por videógrafo)
- El calendario de grabación (menú **Grabación**) se rediseñó: header pulido, celdas más limpias, y **las grabaciones se colorean por videógrafo** (cada persona su color, igual que el board), con una **leyenda de colores** arriba para ver de un vistazo quién graba qué. Theme-aware (se ve bien en claro y oscuro). Se mantienen vistas Calendario/Lista, filtros y crear/editar sesión.

## v2.18 — 2026-06-04

### Título editable por video
- Cada video del lote tiene ahora un **título editable** (clic para renombrar; se guarda al instante). Debajo queda "Video N · Reel" como referencia. No requiere migración (la columna `title` ya existe).

## v2.17 — 2026-06-04

### Resumen del lote editable: nombre, cantidad de videos y encargado
- En el Lote de videos, el recuadro de resumen ahora es **editable**:
  - **Encargado** — selector de persona para **asignar** el cliente/lote a alguien del equipo (funciona ya).
  - **Lote** — nómbralo (ej. "Junio 2026").
  - **Videos** — fija la **cantidad de videos** del lote (sobrescribe el cálculo automático por cadencia).
- Nota técnica: el Encargado funciona de inmediato; **Lote** y **cantidad** requieren aplicar la migración `0031_client_batch_config.sql` en la base de producción (Nathan la corre una vez). El código degrada con elegancia mientras tanto.

## v2.16 — 2026-06-04

### Los videos del lote ya vienen creados, con idea y caption editables en cada uno
- Al abrir un cliente, los **videos del lote ya están creados** automáticamente (uno por cada espacio de la sesión, con su fecha de publicación). Se acabó el "Crear video" en cada espacio.
- **Cada video es una tarjeta de trabajo** donde escribes y editas **la idea** (gancho, brief visual, ángulo, hashtags, fecha) y **el caption** (a mano o con IA) **ahí mismo**, sin abrir un panel aparte. Debajo, la **subida de la grabación** (raw / b-roll / editado).
- Vista en grid de 2 columnas, más limpia y profesional.

## v2.15 — 2026-06-04

### Lote de videos más parecido al diseño + idea/caption editables por video
- **Cada video tiene su idea y su caption editables**, además de la subida de la grabación (raw / b-roll / editado). La idea (gancho, brief, hashtags, fecha de publicación) y el caption (con generación por IA) se editan directo en el panel de detalle.
- **Filtros en la sección de videos**: chips **Todos / Por grabar / Grabados** para ver rápido lo que falta.
- En el resumen del lote ahora se muestra el **Encargado** (la persona responsable del cliente).

## v2.14 — 2026-06-03

### Todo corre por el Pipeline: el Lote de videos abre ahí mismo y los botones funcionan
- En el **Content Pipeline Board**, hacer clic en la tarjeta de un cliente ahora **abre el Lote de videos ahí mismo, a pantalla completa** (superposición), sin salir del pipeline. Botón **Cerrar** para volver.
- **Los botones ahora funcionan:**
  - **"Nuevo video"** crea el video de verdad (con el cliente ya seleccionado).
  - En cada video, la **subida de grabación va a R2** (raw / b-roll / editado), usando el flujo de subida real de la app.
  - En los espacios planificados, **"Crear video"** crea el video de ese espacio.
- Se **quitó "Workflow"** del menú lateral: el pipeline es ahora el único centro de trabajo.

## v2.13 — 2026-06-03

### Lote de videos: muestra los 15 espacios a crear, con día, idea y caption
- Al abrir el **Lote de videos** de un cliente que aún no ha empezado, ahora aparecen los **espacios de video del próximo lote** (ej. 15) en vez del estado vacío.
- Cada espacio muestra **qué día de la semana se postea** (según la frecuencia, ej. "Mar 9 jun") y los campos pendientes: **Idea** (por crear) y **Caption** (por crear), con botón para **subir la grabación**.
- Las fechas salen de la cadencia de posteo del cliente; los espacios son visuales (no crean filas en la base).

## v2.12 — 2026-06-03

### Sesiones planificadas para todos los clientes activos + board en light/dark
- Las **tarjetas de sesión planificada** (espacios vacíos "por idear") ahora aparecen para **todos los clientes activos con cadencia que aún no han empezado** (sin ideas). Los que ya tienen ideas conservan su tarjeta de batch normal — nada se duplica.
- El **Content Pipeline Board** ahora **respeta el modo claro/oscuro** de la app (antes estaba forzado a oscuro). En light mode el fondo es blanco, como el resto del dashboard.

## v2.11 — 2026-06-03

### Sesiones planificadas con espacios vacíos en el board (piloto: Nathandavid)
- El board ahora puede mostrar, en la columna **Ideas**, las **sesiones de grabación planificadas** de un cliente como **tarjetas con espacios vacíos** ("por idear"), aunque todavía no existan ideas creadas.
- El total mensual sale **automático de la frecuencia de posteo** (ej. diario ≈ 30/mes) y se parte en sesiones según la cadencia de grabación (≈ cada 2 semanas) → ej. **2 tarjetas de 15 espacios**.
- Los espacios son **visuales** (no crean filas en la base): al crear una idea real, llena un espacio.
- Activado **solo para el cliente "Nathandavid"** por ahora (piloto); se extiende a los demás cuando se valide.

## v2.10 — 2026-06-03

### Clic en un cliente del board → "Lote de videos"
- En el **Content Pipeline Board**, hacer clic en la tarjeta de un cliente ahora abre su **Lote de videos** (`/clients/[id]/batch`) en vez del perfil. Aplica a **todos los clientes** — es la vista estándar al seleccionar un cliente desde el board.

## v2.9 — 2026-06-03

### El Content Pipeline Board es ahora la pantalla principal
- Al **iniciar sesión** (y al entrar a la raíz del app) el usuario va directo al **Content Pipeline Board** (`/pipeline`), en vez de la pantalla de Operaciones. Es el centro de trabajo del equipo, por ahora.

## v2.8 — 2026-06-03

### Nueva pantalla: "Lote de videos" del cliente
- Al abrir un cliente (Clientes → menú ⋯ → **"Lote de videos"**) hay una **pantalla completa** dedicada al lote de videos que se está trabajando, pensada para que **cualquiera entienda el flujo sin entrenamiento**.
- **Línea de etapas** (Idea → Título → Caption → Video → Edición → Aprobación → Publicación) con la etapa actual marcada **"AQUÍ"**, para ver de un vistazo dónde va el lote.
- **Guía "qué hacer ahora"** en lenguaje sencillo según la etapa (ej. "Sube el archivo grabado de cada video").
- **Grid de videos** del lote: los grabados muestran miniatura; los pendientes muestran "Subir grabación".
- **Panel de detalle** al hacer clic en un video: gancho, idea visual, caption, hashtags, fechas, aprobación y archivos (raw / b-roll / editado).
- Usa los **clientes y videos reales** del dashboard.

## v2.7 — 2026-06-03

### Quitado el tab "Flujo" del cliente
- Se eliminó el tablero "Flujo" (5 columnas, estilo viejo) dentro de cada cliente — el **board Pipeline global** (por batches) ya es el único lugar del pipeline. Al hacer clic en un batch ahora se abre el cliente directamente.

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
