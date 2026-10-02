# Biblioteca Compartida De Motion Array

Solicitud de Eric, 27 septiembre 2026: documentar siempre lo descargado, mostrar el progreso, guardarlo en el disco externo y permitir que otros clientes/editores encuentren y reutilicen recursos adecuados. Puede usarse un archivo ya descargado; no descargar duplicados por obligación.

## Ubicación

- Biblioteca: `/Volumes/Extreme SSD/Nate Media/Biblioteca Motion Array/`
- Catálogo reutilizable: `catalogo.json`; buscador con audio: `index.html`.
- Copias independientes del proyecto: `archivos/`, identificadas por SHA256.
- Progreso: `actividad.jsonl`; estados `seleccionado`, `descargando`, `descarga_fallida`, `descargado_verificado`. No confundir descarga con uso, render o aprobación.
- El SSD debe estar montado. No sustituirlo silenciosamente por una carpeta local.

## Flujo Obligatorio Para Cualquier Cliente

1. Buscar primero por significado de la frase/acción en el catálogo. Audicionar la variante concreta. El título o etiqueta no prueba que el sonido encaje.
2. Si ya existe, usar la copia verificada; no volver a descargarla. Si falta, registrar el recurso con su URL pública, autor, tipo, etiquetas, licencia y evidencia antes de descargar.
3. Avisar al usuario qué se seleccionó y cuándo se está descargando. Registrar `descargando` justo antes de la descarga real; `descarga_fallida` si falla. No inventar progreso retrospectivo al importar material antiguo.
4. Descargar con la cuenta autorizada de Motion Array al SSD. Conservar variantes útiles y evidencia de licencia. Nunca guardar credenciales ni enlaces firmados temporales en el catálogo.
5. Verificar archivo, duración y hash; incorporarlo a la biblioteca con `verify`. Copia por contenido, sin tocar el original ni romper proyectos existentes.
6. Registrar cada uso: cliente, reel, versión, frase/acción, tiempo, variante/hash, volumen/recorte, exportación y estado (propuesta, usado, aprobado o descartado en esa escena).
7. Los efectos son reutilizables entre clientes si encajan. Una canción ya usada sigue sujeta a la regla de música distinta por reel de `AGENTS.md`, salvo instrucción expresa más reciente. No interpretar acceso a la biblioteca como aprobación editorial o permiso ilimitado de licencia.
8. Sonorizar con recursos descargados reales cuando corresponda al diálogo. No añadir un sonido arbitrario a cada palabra. Al sustituirlo, conservar la versión anterior y verificar el MP4 hasta el cierre.
9. Reconfirmación global de Eric, 2026-10-02: variar la música entre reels y también su ritmo y carácter según la idea. Consultar `styles/music-usage.json`, recetas y usos del catálogo antes de elegir; otra mezcla o recorte de la misma canción no constituye una pista distinta. Registrar la selección por reel.

## Comandos

Desde `video-pipeline`:

```sh
python3 scripts/motion_array_library.py register /ruta/recurso.json
python3 scripts/motion_array_library.py status ID descargando
python3 scripts/motion_array_library.py verify ID /ruta/descargada/sonido.wav
python3 scripts/motion_array_library.py use ID /ruta/uso.json
python3 scripts/motion_array_library.py build
```

El manifiesto requiere `id`, `title`, `author`, `kind` (`efecto` o `musica`), `url` pública, `tags`, `guidance` y `license` con nombre y evidencia. El registro de uso requiere `client`, `reel`, `version`, `status`, `file_sha256`; añadir frase, segundo, recorte, ganancia y exportación cuando se aplique.

Para ver el buscador: servir la carpeta de biblioteca con un servidor local y abrir `index.html`. `preload=none` evita cargar todos los WAV; solo reproduce un audio a la vez.
