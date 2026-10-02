# Pipeline dentro de Social Dashboard

Esta carpeta reúne el motor local de edición, sus pruebas, fichas, perfiles y recetas. Fue incorporada desde el espacio de producción de Nate Media el 2026-10-02, con autorización para publicar fichas y recetas. No es un servicio de render en Vercel ni instala un editor en la interfaz web.

## Preparar otro equipo

1. Instalar Python 3.9+, Node 22+ y FFmpeg/ffprobe con libass. Mantener `ffprobe` en PATH; si FFmpeg no está en `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`, configurar `FFMPEG` con la ruta de su ejecutable antes de renderizar o ejecutar las pruebas.
2. Instalar las dependencias del dashboard desde la raíz: `npm ci`.
3. Desde esta carpeta: `python3 -m venv .venv`, activar el entorno y ejecutar `pip install -r requirements.txt`.
4. Restaurar los medios autorizados desde Drive/R2/SSD siguiendo `GUIAS-RECURSOS.md` y `styles/client-assets.json`. Las fuentes, logos, outros, música, originales y exports no se distribuyen en Git. La única fuente incluida es una fixture de prueba Montserrat con su licencia OFL.
5. Configurar las credenciales localmente en el `.env.local` del dashboard. Nunca subirlas. Los conectores detectan el dashboard padre; `DASHBOARD_PATH` permite usar otro checkout y conserva la compatibilidad con el diseño anterior de carpetas hermanas.
6. Consultar `GLOBAL-EDITOR-RULES.md`, `GUIAS-POR-CLIENTE.md`, `CAPTIONS-POR-CLIENTE.md` y la ficha del cliente antes de editar.

## Límites del traslado

- Las recetas son un historial, no paquetes autónomos. Conservan rutas absolutas del SSD y rutas relativas al espacio original para mantener su procedencia. Restaurar los archivos y adaptar las rutas en una versión nueva antes de renderizar en otro equipo.
- `runs/`, catálogos de trabajo, transcripciones y exportaciones quedan fuera de Git. Consultar el dashboard/Drive para reconstruir un lote. La ausencia de estos archivos no demuestra que un video esté pendiente o no publicado.
- Algunas notas de las fichas describen correcciones de piezas concretas y estados históricos. La corrección más reciente del usuario prevalece. No convertir entregas en aprobaciones.
- La copia original no se elimina ni se sincroniza automáticamente. Los nuevos cambios del repositorio deben hacerse aquí; cualquier traslado desde el espacio anterior necesita una revisión y commit explícitos.
- Una modificación musical requiere una nueva exportación y su grafo. La reproducción, imagen, escucha crítica, aprobación del cliente, Recibo y publicación son controles separados.

## Comprobar instalación

```sh
python3 pipeline.py --help
python3 -m unittest discover -p 'test_*.py'
node --test test_dashboard_paths.mjs
```

La prueba editorial que requiere la transcripción local de Sashimi/Nigiri se omite explícitamente si falta ese original. El resto de las pruebas usa fixtures locales o medios sintéticos y no necesita credenciales.
