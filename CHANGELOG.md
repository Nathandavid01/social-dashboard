# Changelog

Novedades del dashboard de Nate Media. Cada entrada resume lo que cambió en un commit.

> Versionado: cada merge a `main` sube la versión. Una **feature grande** sube el número grande (1.x → 2.0); una **feature pequeña o fix** sube el número pequeño (1.4 → 1.5).

## v2.74 — 2026-06-19

### Onboarding guiado: navegación hacia atrás + editar pasos
- El asistente de **Agregar cliente** ya no es solo hacia adelante: ahora tiene botón **"Atrás"** en cada paso, los **chips del progreso son clickeables** (saltas a cualquier paso para revisar/corregir) y desde el resumen final puedes **"Volver a revisar"**.
- Si vuelves al paso 1 después de crear el cliente, el botón cambia a **"Guardar y continuar"** (edita en vez de duplicar). Hace que el flujo se sienta como un wizard de verdad, no una vía de una sola dirección.

## v2.73 — 2026-06-19

### Reporte de cliente: Audiencia + Plan de acción (datos reales)
- **Audiencia** (de Metricool): **género**, **edad** y **top ubicaciones** de quién te sigue, más el **conteo de seguidores** como KPI. Le muestra al cliente *a quién* está llegando.
- **Tu plan del próximo mes**: recomendaciones concretas y **respaldadas por tus números reales** — formato ganador, **mejor hora para publicar** (Metricool), guardados y **clics al enlace** generados — con un botón para que el cliente **suba su material**.
- Todo aterrizado solo en datos que Metricool sí entrega; degrada suave si una red no los reporta.

## v2.72 — 2026-06-19

### Selector de cliente escribible (buscador)
- En **Caption rápido**, el selector de **Cliente** ahora es un **buscador**: escribes parte del nombre y filtra al instante (con decenas de clientes ya no hay que scrollear una lista larga). Muestra el nombre elegido, marca cuáles no tienen Metricool, y dice "Sin resultados" si no encuentra.
- Componente reutilizable (`ClientCombobox`) para usarlo en otros selectores de cliente más adelante.

## v2.71 — 2026-06-19

### "Caption rápido" ahora también aprende
- En el modal **Caption rápido** (emergencias) ahora puedes **ajustar con feedback** ("más corto", "menos emojis"…) y **regenerar**, y calificar el resultado con **👍 / 👎** (con nota opcional) — igual que en el pipeline.
- Esos votos alimentan el **mismo learning loop por cliente** (los 👍 como ejemplo a imitar, los 👎 como qué evitar). Y al revés: el caption rápido ahora **usa** los captions aprobados + las calificaciones del cliente al generar (antes ignoraba todo eso).
- Como el caption rápido no tiene "idea" en la base, la calificación se guarda **por cliente** directamente. Requiere la migración `0041` para guardar votos; degrada seguro sin ella.

## v2.70 — 2026-06-19

### Onboarding de cliente guiado paso a paso
- **"Agregar cliente" ahora es un asistente guiado** (en vez de un formulario largo de una sola pantalla): te lleva paso a paso con barra de progreso hasta dejar el cliente **listo para automatizar**.
- Pasos: **1) Datos** (nombre, redes, idioma, encargado) → crea el cliente · **2) Conectar Metricool** (con buscador de cuentas) · **3) Días de posteo** · **4) Voz de marca** (voz, CTA, hashtags, reglas) · **5) Resumen** con lo que quedó configurado.
- Cada paso explica **para qué sirve**, los opcionales se pueden **"Saltar por ahora"**, y al final ofrece **crear el primer lote de videos** o ir al perfil. Usa las acciones reales (createClient, días de posteo, voz) — nada paralelo. Sin migración.

## v2.69 — 2026-06-19

### Reporte de cliente más profesional: gráficas + IA + top posts
- El reporte del cliente ahora es **más visual y ejecutivo**: en vez de la lista larga de posts, muestra **gráfica de alcance en el tiempo**, **split por red (Instagram/Facebook)** y solo las **3 publicaciones destacadas**.
- Nuevo **"Resumen del estratega" (IA)**: un análisis en lenguaje natural de **lo que logramos**, **qué está funcionando** y **hacia dónde va la estrategia** — escrito con la data real (alcance, deltas, mejor formato). Si la IA no está disponible, usa un resumen determinístico con los números.

## v2.68 — 2026-06-19

### Hotfix: build roto por marcadores de conflicto
- Se quitaron marcadores de conflicto de git (de un `git stash pop` que se coló a `main`) en 8 archivos de Ideas/Captions que rompían la compilación. Sin cambios de comportamiento (se conservó el código ya publicado).

## v2.67 — 2026-06-19

### Nueva sección "Reportes" (elige el tipo)
- Nueva sección **Reportes** en el menú, con un **selector**: eliges el **tipo de reporte**, el **cliente** y el **período** (7 / 30 / 90 días).
- **Reporte de cliente**: ahora muestra los KPIs (alcance, impresiones, interacciones, posts) **con comparación vs el período anterior** (↑/↓ %) además de la lista de publicaciones.
- **Resumen de agencia**: ranking de **todos los clientes por alcance** (con barra e impresiones) y los totales de la agencia.
- Todo imprimible / PDF. El botón "Reporte" del perfil del cliente ahora abre esta sección.

## v2.66 — 2026-06-19

### Link de subida con el nombre del cliente
- El link para que el cliente suba sus videos ahora puede usar **su nombre** en vez del id largo: p. ej. **`/subir/primer-round-oficial`**. Los links viejos con id (UUID) **siguen funcionando**.
- Nuevo botón **"Link de subida"** en el perfil del cliente: lo copia listo para enviárselo. (Si dos clientes tuvieran el mismo nombre, ese link queda ambiguo y no abre — usar el de id; lo ideal a futuro es un token propio.)

## v2.65 — 2026-06-19

### Crea tu avatar (al iniciar sesión)
- Al entrar, si todavía no tienes **foto de perfil**, aparece un **creador de avatar**: elige uno **generado** (6 estilos: ilustrado, cartoon, abstracto, glass, geométrico, iniciales — con botón **Aleatorio**) o **sube tu foto**.
- Es **opcional** ("Más tarde") y **vuelve a preguntar en cada inicio de sesión hasta que pongas uno**. Cuando lo eliges, deja de preguntar.

## v2.64 — 2026-06-19

### Captions: el loop de aprendizaje ahora se ve y se auto-mejora
- En el editor de caption aparece un indicador **"La IA está aprendiendo de N captions de este cliente"** (aprobados + 👍, y cuántos rechazados evita) — para que el equipo vea que el sistema mejora con su uso.
- **Sugerencia de regla automática:** cuando un motivo de 👎 se repite (p. ej. "menos emojis" 3×), el editor ofrece **"Agregar a reglas"** con un clic, que lo guarda en las reglas del cliente (`caption_notes`) para que la IA lo respete siempre. Gated por `clients.brand.edit`.
- Todo best-effort y sin migración: si aún no hay datos, simplemente no aparece. (Los conteos de 👍/👎 se llenan cuando se aplique la migración `0041`.)

## v2.63 — 2026-06-19

### Reporte de desempeño por cliente
- Nuevo **reporte profesional por cliente** (botón **Reporte** en el perfil del cliente → `/clients/[id]/reporte`): muestra las **publicaciones** del período (Instagram + Facebook) con su **alcance, impresiones, me gusta, comentarios, compartidos, guardados y reproducciones** por post, más KPIs arriba (personas alcanzadas, impresiones, interacciones, # de publicaciones).
- Marca el **post de mayor alcance**, se puede ver a **7 / 30 / 90 días**, y trae botón **Imprimir / PDF** para compartirlo con el cliente. Diseño tipo documento (limpio, imprimible).
- Datos en vivo de Metricool (server-side, token nunca expuesto). Sin migración.

## v2.62 — 2026-06-19

### Captions: calificar 👍/👎 para que aprendan (learning loop · fase 2)
- En el editor de caption ahora puedes **calificar** cada caption con **👍 Me gusta** o **👎 No es** (con una nota opcional de qué estuvo mal).
- El generador usa esas calificaciones por cliente: los **👍 pesan como el mejor ejemplo a imitar** (por encima de los aprobados y de Metricool), y los **👎 (con su motivo) le dicen qué evitar**. Mientras más calificas, más se afina a la voz del cliente.
- Aplica en ambos generadores (ideas planificadas e Ideas Aprobadas). **Requiere la migración `0041_caption_feedback.sql`**; degrada seguro hasta aplicarla (la generación sigue funcionando; solo el voto avisa con error).

## v2.61 — 2026-06-19

### El alcance real aparece de inmediato
- Se invalidó el cache viejo del contador de alcance (tenía guardado el valor vacío anterior), para que el login muestre el total real (~9.6M) sin esperar 24h.

## v2.60 — 2026-06-19

### El contador de alcance ahora SÍ trae datos reales (~9.6M)
- Se corrigió de dónde se lee el reach: antes pegaba a `/stats/posts` (solo cuenta lo publicado *vía* Metricool → venía vacío). Ahora usa **`/stats/aggregations/{red}`** (Instagram/Facebook/TikTok), que es el **alcance real de las cuentas**. Con tus 62 clientes da **~9.6M personas alcanzadas** (12 meses) en vez de quedar oculto.
- Solo cuenta **reach real** (Instagram `reach`, Facebook reach único cuando existe) — no impresiones, para que el número sea honesto.
- El cron diario de Metricool ahora **precalienta** ese total, así el login lo muestra al instante sin recalcular 60+ cuentas en cada visita.

## v2.59 — 2026-06-19

### Contador del login: honesto + diagnóstico
- El contador de "personas alcanzadas" ahora **solo muestra el número real de Metricool**. Si el servidor no consigue datos reales (Metricool sin configurar, sin `metricool_blog_id`, o error), **el contador no aparece** — se acabó el número estimado que subía solo. El rótulo ahora dice **"Alcance · últimos 12 meses"** (ya no "en vivo").
- Nuevo diagnóstico **`GET /api/reach-status`** (solo owner): dice si el contador está leyendo **real** o no, cuántos clientes tienen Metricool, el reach por cuenta y una pista de qué falta (env, blogId, permisos de insights).

## v2.58 — 2026-06-19

### Login: "Recordar mi correo"
- El login ahora tiene un check **"Recordar mi correo"**: la próxima vez que entres, tu correo aparece **ya escrito** (solo el correo, nunca la contraseña). Se guarda en tu navegador; si lo desmarcas, se borra.

## v2.57 — 2026-06-19

### Login: panel de marca centrado
- En la pantalla de login, el contenido de la columna izquierda (logo, titular, beneficios y contador) ahora aparece **centrado verticalmente** como un bloque, en vez de repartido arriba/abajo. El aviso legal queda anclado al pie.

## v2.56 — 2026-06-19

### El contador del login ahora muestra el alcance REAL de Metricool
- El **contador de "personas alcanzadas"** del login dejó de ser una estimación: ahora suma el **reach real** de las publicaciones de **todas las cuentas que operamos** (últimos 12 meses), leído de la API de Metricool en el servidor.
- Se calcula **cacheado 1×/día** (no recalcula en cada login) y con timeout: si Metricool no está configurado o tarda, cae suave al contador anterior sin romper el login. El token de Metricool nunca llega al navegador.
- Cuando hay número real, el contador hace su animación de subida y se queda en el total real (ya no inventa crecimiento en vivo).

## v2.55 — 2026-06-19

### Nuevo login: logo radar + contador de alcance en vivo
- **Login rediseñado** (negro + dorado): el panel de marca ahora tiene un **logo tipo radar / torre de control** (monograma N dorado con barrido animado) y un wordmark más grande.
- **Contador histórico en vivo** de *personas alcanzadas en todas las cuentas que operamos* — sube al cargar y sigue contando en tiempo real (respeta `prefers-reduced-motion`).
- No cambia nada del flujo funcional de login (formulario, `signIn`, Supabase) — solo la presentación.

## v2.54 — 2026-06-19

### Captions que aprenden de cada cliente (learning loop)
- El generador de captions ahora **estudia los captions que el equipo ya aprobó para ese cliente** y los usa como **el estándar exacto a igualar** — con más peso que los ejemplos de Metricool. Mientras más captions apruebas, más se acerca al estilo del cliente.
- Toma los aprobados de **ambos lados** (pipeline `content_ideas` + Ideas Aprobadas del Idea Lab), sin duplicados y priorizando los más recientes.
- Aplica en **todas** las generaciones (ideas planificadas e ideas aprobadas). Best-effort: si no hay aprobados aún, genera como antes. Sin migración.
- (Fase 2 sugerida: rating 👍/👎 explícito por caption para una señal aún más limpia.)

## v2.53 — 2026-06-19

### Los clientes suben sus propios videos (link mágico) — Fase 1
- Nueva página pública **`/subir/<id-del-cliente>`**: el cliente abre el link desde su celular, **graba o elige un video**, escoge **formato (Reel/Post)**, **tipo de contenido** (promoción, testimonio, detrás de cámara…), un **brief opcional** y la **fecha deseada**, y lo envía.
- El video crudo sube directo a **Cloudflare R2** y aparece solo en el **pipeline del equipo** como una idea con su material adjunto — para editar **sin tener que ir a grabar**.
- Sin login para el cliente (el id del link es el acceso por ahora) y sin migración: reusa el almacenamiento R2 y el pipeline existentes.
- (Próximo paso: token real por cliente + botón "Copiar link de subida" en el perfil del cliente, y luego envolverlo como app iOS con Capacitor.)

## v2.52 — 2026-06-19

### Áreas: panel desplegable debajo de cada persona
- En **Usuarios y permisos**, configurar las **áreas** de una persona ya no abre una ventana modal: ahora el botón **"Áreas"** despliega un **panel justo debajo de su tarjeta** (con una flechita que indica abierto/cerrado).
- Mismo control de siempre: **Acceso completo (según el rol)** o **restringir a áreas específicas** con una lista de casillas. Guardar cierra el panel.

## v2.51 — 2026-06-19

### Feedback al generador de captions con IA
- En el editor de caption ahora puedes **"Regenerar con feedback"**: le dices a la IA qué cambiar ("más corto", "menos emojis", "más llamado a la acción", "tono más formal") y reescribe el caption aplicando tu instrucción, sin perder el mensaje central ni el estilo del cliente.
- La IA recibe tu **feedback + el intento anterior**, así mejora sobre lo que ya había en vez de empezar de cero.
- (Próximo paso sugerido: que el feedback recurrente se aprenda por cliente, como el learning loop del Idea Lab.)

## v2.50 — 2026-06-19

### Usuarios y permisos: vista moderna en tarjetas
- **Usuarios y permisos** se rediseñó de una tabla densa a una **lista de tarjetas** más fácil de leer: cada persona muestra su **avatar con inicial** (color según el rol), nombre, email/título, su **rol**, sus **áreas**, y un **estado Activo/Inactivo** claro.
- Nueva **barra de búsqueda** (por nombre o email) y **filtro por rol** (Todos · Owners · Supervisores · Editores) para encontrar gente al instante.
- Las acciones de edición se ordenaron: cambiar **rol** y **áreas** y **resetear contraseña** siguen a un toque; **editar nombre/título** y **activar/desactivar** pasaron a un menú **⋮** por persona (en vez de cajas de texto siempre visibles).
- Cuando un filtro no encuentra a nadie, se muestra un **estado vacío** claro.

## v2.49 — 2026-06-19

### Fecha límite restaurada (se había perdido en un merge)
- Vuelve el **editor de fecha límite** en la tarjeta "La idea" (junto a la fecha de publicación) — se había caído al integrar otra rama.
- Vuelve el **badge Atrasado/Pronto** en la tarjeta de cada video del lote **y** en las tarjetas del pipeline (urgencia visible sin abrir el cliente).
- Arreglados de paso 2 tests que estaban rojos en `main` (el de fecha límite y un fixture de `client-video-section`); `tsc` queda limpio.

### Onboarding de cliente más simple e intuitivo
- **Tarjeta "Listo para automatizar"** en el perfil del cliente: una checklist en vivo (activo · Metricool · días de posteo · voz de marca · primer lote) que muestra **qué falta** con un atajo directo a cada cosa. Desaparece cuando el cliente queda 100% configurado.
- **Activar en un clic** desde la checklist (ya no hay que ir a editar para sacarlo de "onboarding").
- **Clientes nuevos nacen "Activos"** por defecto, así el pipeline y la auto-publicación funcionan desde el inicio (antes nacían en "onboarding" y había que activarlos a mano).

## v2.47 — 2026-06-16

### Login rediseñado (negro + dorado Nate Media)
- Pantalla de inicio de sesión nivel **agencia profesional**: layout **split-screen** con un panel de marca a la izquierda (monograma N dorado, propuesta de valor y 3 beneficios) y el formulario a la derecha.
- Formulario en **español** con inputs con íconos, mostrar/ocultar contraseña, estado de carga y errores claros.
- En móvil se apila con la marca arriba. Nuevo componente reutilizable **`NateLogo`** (monograma de marca).
- Reemplaza el login genérico "AgencyFlow / Welcome back" por la identidad real de Nate Media.

### Pipeline: tarjetas planificadas y flujo idea → caption → grabación
- Las **tarjetas planificadas** muestran el **logo del cliente**, días desde el inicio y días en la fila actual, con un estilo distinto (borde punteado celeste, sin barra lateral).
- Al hacer clic en una tarjeta planificada se abre el **flujo de un solo video** (idea → caption → grabación) con la fecha de publicación ya calculada.
- El **caption** solo se genera cuando la idea tiene **hook y brief visual** completos; el tablero se actualiza al guardar.
- **Nuevo video** lista todos los clientes activos con el estado de su pipeline.

# v2.45 — 2026-06-16

- **El tablero (Content Pipeline) ahora da la bienvenida cuando está vacío.** Si todavía no hay ningún video, en vez de mostrar 7 columnas con un "—" (que parecía roto), aparece un mensaje claro que explica el flujo (idea → título → caption → grabación → edición → aprobación → publicación) con un botón para **crear el primer video**.

## v2.44 — 2026-06-16

- **El Idea Lab te muestra que está trabajando.** Mientras la IA genera ideas (que puede tardar unos segundos), el panel de resultados ahora muestra **tarjetas "fantasma" animadas** y un texto *"Generando N ideas con IA…"*, en vez de quedarse con la pantalla vacía como si no pasara nada.

## v2.43 — 2026-06-16

Más usabilidad, ahora en celular y en consistencia de idioma:

- **Clientes se ve bien en celular.** La lista de clientes ahora muestra **tarjetas** en pantallas pequeñas (nombre, estado, plataformas, si tiene Metricool/IA y el menú de acciones) en vez de una tabla que escondía casi todas las columnas. En pantalla grande sigue igual, como tabla.
- **Todo en español.** Se tradujeron textos que habían quedado en inglés en la sección de Clientes: el título "Clients" → **Clientes**, "Add Client" → **Agregar cliente**, los estados **Activo/Pausado**, y los encabezados de crear/editar cliente.
- **Detalle:** la tarjeta de "Activos" ya no aparece cuando todavía no tienes clientes (antes mostraba "Activos 0", que parecía un error).

## v2.42 — 2026-06-16

Tanda de mejoras para que la app se sienta más fácil y confiable de usar:

- **Confirmación bonita antes de borrar (ya no el cuadro feo del navegador).** Eliminar un cliente o una idea ahora abre un diálogo claro con tono de advertencia y botón rojo, en español — en vez del `confirm()` gris del sistema operativo. Borrar una idea además **avisa con un toast** cuando termina (antes no decía nada).
- **Pantalla de "sin clientes" con acción.** Cuando no hay clientes, ahora ves un botón **"Agregar cliente"** (y si filtraste y no hay resultados, un **"Limpiar filtros"**) — en vez de una pantalla vacía sin salida.
- **El tablero (Content Pipeline) funciona en celular/tablet.** Los botones para **mover un video** entre etapas ahora se ven y se pueden tocar en pantallas táctiles (antes solo aparecían al pasar el mouse, imposible en celular), y la **búsqueda** ya no se esconde en móvil.
- **Detalles pulidos:** los botones "Filtros" y "Agrupar" (que aún no hacen nada) ahora se ven deshabilitados con "Próximamente" en vez de parecer rotos; se arregló una caja de texto que se veía oscura en modo claro al asignar a producción; y copiar un brief ya no falla en silencio si el navegador bloquea el portapapeles.

## v2.41 — 2026-06-16

- **Sabes cuándo se va a publicar cada video, justo antes de enviarlo.** En **Ideas Aprobadas → Captions y Metricool**, cada idea ahora muestra un aviso (escrito por la IA) con **cuándo y dónde** se publicará su próximo contenido según la **cadencia del cliente** — p. ej. *"📅 El Reel de La Placita Café se publicará el viernes 20 de junio en Instagram, Facebook y TikTok."* Además, la **fecha de programación se rellena sola** con ese próximo día de cadencia, así no hay que adivinarla. (El aviso se cachea por día, así que no gasta API de más.)

## v2.40 — 2026-06-16

- **Los captions ahora los escribe Grok (xAI) en vez de Claude.** Misma calidad de redacción (mismo prompt, misma voz de marca y mismos ejemplos reales del cliente de Metricool), pero más rápido y mucho más económico por caption. Aplica en todos los lugares donde se genera caption: ideas, ideas aprobadas, caption rápido y la automatización de videos aprobados. Si en algún momento se prefiere volver a Claude, se cambia con una sola variable (`CAPTION_PROVIDER=claude`) — sin tocar código. *(El chat y la generación de ideas siguen usando Claude.)*

- **Edita la cadencia de cada cliente tú mismo:** define qué días postea cada cliente y el tipo de cada día (**R = Reel** / **P = Post**) sin depender de nadie. Está en **dos lugares**: en el **perfil del cliente → Calendario** (tocas los días) y en **Producción → Cadencia**, donde ahora la parrilla es **clickeable** (tocas una celda para alternar R → P → vacío y se guarda solo).
- **Importar clientes de Metricool:** en **Clientes**, el botón **"Importar de Metricool"** lista las marcas conectadas en Metricool que aún no son clientes y las crea en un clic (con su *blog id* enlazado) — sin retipear.

## v2.38 — 2026-06-15

- **Cadencia semanal por cliente, en vivo:** la pestaña **Producción → Cadencia** ahora muestra la parrilla real de cada cliente (clientes × días, con píldoras **R = Reel** y **P = Post** y un **Total** semanal), leída directo de la base de datos en vez de una lista fija desactualizada. Se cargó la cadencia actual de **36 clientes** (114 publicaciones/semana), así que cada cliente ya tiene su frecuencia atada. Edítala desde el botón **Horarios**.

## v2.37 — 2026-06-14

- **Arreglo: las áreas/permisos de usuario ahora SÍ se guardan.** La base de datos había perdido la regla de seguridad que permite al administrador editar el perfil de **otros** usuarios, así que al asignar áreas (o cambiar rol/estado) parecía guardarse pero no cambiaba nada. Restaurada la regla; ahora el administrador puede definir a qué secciones entra cada persona y se persiste correctamente. Además, si alguna vez una edición no tiene permiso, ahora se avisa con un error claro en vez de fingir que se guardó.

## v2.36 — 2026-06-14

- **El formato del post ahora coincide con el tipo de la idea:** al programar/publicar desde el Lab de Ideas (o el caption rápido), el video se sube a la red social con el **formato correcto según el tipo planeado** — Reel como Reel, Story como Story, Post/Carrusel como publicación de feed — en Instagram y Facebook. Antes solo el Reel se enviaba con su formato; Story y Post salían como video plano. Si la red rechaza el formato, se reintenta sin él para no bloquear la publicación.

## v2.35 — 2026-06-14

- **Registro público deshabilitado:** ya no cualquiera puede crear su cuenta desde la pantalla de inicio de sesión. Las cuentas nuevas las crea un administrador **desde adentro de la app**, controlando quién entra.
- **Gestión de usuarios en Configuración → Usuarios:** un solo lugar (solo administradores) para crear cuentas, asignar rol (Owner/Supervisor/Editor/Videógrafo) y controlar permisos. **Equipo** queda como vista del equipo con un enlace a este panel.
- **Permisos por área por usuario:** el administrador define a qué secciones de la app puede entrar cada persona, independientemente de su rol. Las áreas no permitidas se ocultan del menú **y** se bloquean por URL (si la escriben a mano, se les redirige a Inicio). El Owner nunca queda bloqueado.
- **Aprobación de cuentas:** infraestructura para que cuentas nuevas queden "pendientes" hasta que un Owner las apruebe con un rol (queda lista por si se reactiva el auto-registro).
- **Cambio de contraseña self-service:** cada usuario cambia su propia contraseña desde **menú de usuario → Cambiar contraseña**, sin depender de un administrador ni de correos.

## v2.34 — 2026-06-14

- **Fecha de programación más confiable (Captions → Metricool):** al programar un caption —en **Ideas aprobadas** o en **Caption rápido**— la fecha por defecto ("mañana") ya no se corría un día de más cuando programabas de noche (se calculaba en horario UTC). Ahora usa el día local correcto.
- **No se puede programar en el pasado:** el calendario se limita a **hoy en adelante**, el botón de enviar se desactiva y aparece un aviso si la fecha quedó vencida. Para **autopublicar** (Caption rápido con video) también se bloquea una **hora ya pasada** del mismo día — así un post nunca se publica solo con fecha/hora vencida.

## v2.33 — 2026-06-13

- **Menú móvil ahora hace scroll:** el menú lateral en celular (el cajón que se abre con el botón ☰) no dejaba ver los últimos ítems (Verificación, Automatización, Configuración) porque la lista se cortaba sin poder hacer scroll. Ahora el encabezado queda fijo y la lista de enlaces se desplaza, así alcanzas todas las secciones.

## v2.32 — 2026-06-12

- **Logo nuevo:** ícono de la app rediseñado — una "N" dorada sobre negro (estilo Nate Media). Se ve en la pantalla de inicio del teléfono, la pestaña del navegador y al instalar la app.

## v2.31 — 2026-06-12

- **App instalable (PWA):** ahora puedes instalar el dashboard en tu teléfono o computadora como una app (ícono propio, pantalla completa). Funciona con un service worker que además muestra una página "Sin conexión" cuando no hay internet y carga más rápido los recursos estáticos.
- **Íconos PNG:** íconos nuevos en PNG para que el ícono se vea bien en iPhone (pantalla de inicio) y Android.
- **Mejor en celulares:** los filtros (Captions, Grabaciones, Publicados, Metricool) ya no se cortan en pantallas pequeñas y las tarjetas de resumen se apilan en una columna en teléfonos.

## v2.30 — 2026-06-08

### Historial de subidas por persona (perfil del miembro)
- En el **perfil de cada miembro** (Equipo → persona) ahora hay una sección **"Videos subidos"** con su desglose **Raw · B-roll · Editados**, el **% editado** y **cuándo subió por última vez**.
- **Filtros de tiempo:** **Todo / Este mes / Esta semana** — para comparar la producción de cada quien por período.
- Sin migración (usa los datos de subidas que ya existen).

### Pipeline: filtros que se guardan, estado vacío y accesibilidad
- **Filtros en la URL:** el filtro de cliente y de persona (incluido "Mis videos") ahora se guardan en la dirección (`?cliente=…&persona=…`), así que puedes **compartir/guardar** una vista filtrada y no se pierde al volver al pipeline. Los cards "Planificados" ahora respetan los mismos filtros.
- **Estado vacío claro:** si un filtro no calza con nada, en vez de columnas vacías sale un mensaje ("Ningún batch coincide…" / "No tienes videos asignados…") con un botón **Quitar filtros**.
- **Accesibilidad del tablero:** el área de columnas es enfocable con teclado y se desplaza con las **flechas** (←/→/Home/End); los botones de mover lote aparecen al enfocar con teclado (antes solo con el mouse).

### Más señal en los conteos de videos subidos (Equipo)
- **Última subida:** cada miembro muestra **"última subida hace X días"** con color (verde reciente / ámbar / rojo si lleva mucho sin subir) para detectar a quién se le quedó parado el trabajo.
- **Ratio de edición:** badge **"Editado X%"** (editados ÷ raw) — cuánto de lo grabado realmente se editó.
- **Leaderboard:** medalla 🥇/🥈/🥉 para los tres que más videos han subido.
- Sin migración (usa `uploaded_at` que ya se guarda).

### Mejoras al pipeline y a las fechas límite (auditoría con equipo de agentes)
- **Fechas límite visibles en el tablero:** cada tarjeta de cliente en el pipeline muestra ahora un badge **Atrasado/Pronto** con la urgencia del video más apremiante del lote — se ve sin abrir el cliente.
- **Filtro por fecha límite** en el lote: además de Por grabar/Grabados, puedes filtrar **Atrasados / Pronto** para atacar primero lo urgente.
- **Filtro "Asignado a" arreglado:** ahora aparece un chip para **cada** persona con un video en el lote (antes solo salía el dueño mayoritario, así que alguien con pocos videos no podía filtrarse aunque "Mis videos" sí lo mostrara).
- **Fecha límite en "Mi Lista":** los videos asignados muestran el badge **Atrasado/Pronto** consistente (antes solo un aviso de "pronto").
- **Fix de refresco:** editar una fecha en el lote ahora revalida la vista del cliente (el badge ya no se queda viejo hasta recargar).

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
