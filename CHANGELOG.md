# Changelog

Novedades del dashboard de Nate Media. Cada entrada resume lo que cambió en un commit.

> Versionado: cada merge a `main` sube la versión. Una **feature grande** sube el número grande (1.x → 2.0); una **feature pequeña o fix** sube el número pequeño (1.4 → 1.5).

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
