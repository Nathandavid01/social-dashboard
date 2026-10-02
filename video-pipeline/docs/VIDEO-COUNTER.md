# Contador de videos del pipeline

`completed-videos.json` registra videos únicos por cliente e `idea_id`. La base del 29 de septiembre de 2026 contiene 81 ediciones locales observadas: 77 con reporte del motor y cuatro de Dorado del Mar hechas con scripts específicos. Es una base auditada de las carpetas locales y del SSD; no es un inventario universal de toda edición hecha por AI. No incluye AA Real Estate ni Codepola porque no se encontró una exportación atribuible al pipeline.

`pipeline.py render` registra automáticamente el video después de guardar el MP4, su control de audio y su grafo de revisión. Exige decodificación completa, audio aprobado técnicamente y hashes de evidencia correspondientes al archivo. Cada idea incrementa una sola vez: mantener el mismo `client_id` e `idea_id` en revisiones. Las pruebas `smoke-*` y los lotes `batch-smoke-*` se excluyen; usar `count_video: false` para otras pruebas. El registro significa exportación local verificada, con revisión editorial y aprobación del cliente separadas.

Cada finalización intenta hacer commit **solo del registro** y push a la rama upstream; si no existe upstream usa `origin` y la rama actual. No hace merge, force push ni incluye otros archivos staged. El bloqueo del contador serializa renders concurrentes y la escritura es atómica. Un fallo de Git conserva el conteo local y muestra `pending_sync` o `pending_push`. El push no puede funcionar hasta configurar el remoto del proyecto.

```sh
python3 video_counter.py status
python3 video_counter.py sync  # reintenta commit/push pendiente
python3 video_counter.py record runs/cliente-idea-v1.mp4
```

Para renderizadores personalizados, llamar a `record_finished(output)` después de producir los mismos reportes y controles del motor. No contar crudos, proxies, B-roll ni compilaciones. Los cuatro Dorado históricos están sembrados como `observed_local_export`; las futuras altas automáticas requieren los controles anteriores.
