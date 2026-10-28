# Grafo de Revisión Nate

En cada edición de video de cliente, el agente coordinador consulta las instrucciones y la ficha vigentes del cliente, genera el grafo del pipeline para el export exacto y organiza revisiones independientes. Registrar ruta, versión y SHA-256 del video revisado. Una receta, un grafo generado o una transcripción automática no equivalen a una revisión editorial ni a escuchar el video. El grafo local puede registrar controles pendientes; no inicia agentes automáticamente.

## Equipo de revisión

Asignar estas funciones a revisores independientes, usando agentes cuando estén disponibles. Si la plataforma limita la concurrencia, realizar las revisiones por tandas; si no puede asignarse o ejecutarse una función, marcarla pendiente y explicar por qué. Un control solo pasa con evidencia de la revisión real del export actual.

1. **Captions:** estilo vigente del cliente, legibilidad, ritmo, ubicación y sincronía.
2. **Transiciones:** cortes, continuidad, ritmo, imagen y empalmes con el original.
3. **B-roll:** intentar al menos dos apoyos pertinentes; documentar si no hay material apropiado. Revisar procedencia y datos sensibles.
4. **Fidelidad y voces:** contrastar captions con el audio real, identificar la voz detrás de cámara y usar colores invertidos cuando corresponda al estilo solicitado. No corregir el diálogo por conjeturas de ASR.
5. **Outro:** comprobar que sea el vigente del cliente y que esté bien integrado.
6. **Efectos de transición:** comprobar selección, sincronización y mezcla con la voz, siguiendo [el master prompt](SOUND-EFFECTS-MASTER-PROMPT.md).
7. **Zooms suaves:** buscar momentos pertinentes, aplicar keyframes de entrada y salida suaves, y revisar encuadre, rostro, producto, captions y continuidad; documentar excepciones justificadas. Para reels hablados, planificar un cambio perceptible de encuadre, ángulo o B-roll como máximo cada 4 segundos de contenido activo; un caption nuevo por sí solo no cuenta como cambio de cámara. Sincronizarlo con la narración, sin bombeo ni recortes de diálogo; documentar tramos que deban durar más por razones editoriales, incluidos cierres y outros. Registrar los tiempos y revisar el export completo. Los captions conservan su posición.
8. **Sentido del B-roll:** revisión independiente de su relación con lo que se dice y la misión del video.
9. **Música:** investigar uso previo, procedencia y licencia de la pista; comprobar con escucha su mezcla y adecuación a la idea, estilo o tendencia. No repetir canción entre reels salvo instrucción expresa; las versiones de un mismo reel pueden conservarla.
10. **Documentación y Obsidian:** buscar y leer las reglas, ficha del cliente, historial de la pieza y documentación relevante; identificar fuentes no disponibles. Actualizar la bitácora y, cuando corresponda, la guía del cliente con fecha, alcance, versión/hash, fuentes, decisiones confirmadas, propuestas y pendientes. Preservar historial, leer de vuelta lo guardado y no transformar una excepción en regla global sin respaldo.

El vault local, cuando esté disponible, está en `~/Documents/Obsidian Vault/Nate Media - Editaje/`; consultar especialmente `01 Reglas/`, la ficha del cliente y `06 Historial/`. La ubicación puede variar según el equipo: si no está accesible, registrar el bloqueo y no afirmar que se consultó o actualizó. No guardar credenciales ni información personal innecesaria en las notas compartidas.

## Ciclo y estados

Reunir las críticas con evidencia, corregir lo pertinente en una versión nueva y repetir el grafo y las revisiones para el nuevo hash. Reproducir y escuchar el export completo, incluidos empalmes, como controles separados. Registrar qué revisó cada agente y qué falta; no heredar aprobaciones entre versiones. Presentar como borrador cuando falte una revisión, y mantener separados revisión, aprobación, entrega, programación y publicación. No publicar automáticamente. El usuario puede ver un borrador con sus pendientes claramente indicados.

Las fuentes de cliente y el pipeline local pueden diferir entre equipos. Consultar la ficha y el estado actual antes de actuar; compartir estas instrucciones no instala las dependencias del pipeline ni habilita por sí solo la ejecución automática de agentes.
