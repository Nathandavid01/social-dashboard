# Changelog

Novedades del dashboard de Nate Media. Cada entrada resume lo que cambió en un commit.

> Versionado: cada merge a `main` sube la versión. Una **feature grande** sube el número grande (1.x → 2.0); una **feature pequeña o fix** sube el número pequeño (1.4 → 1.5).

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
