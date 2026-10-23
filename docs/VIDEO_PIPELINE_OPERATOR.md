# Operador del pipeline de video

Entrada HTTP para arrancar un trabajo, ver su estado, listar salidas y reintentar, sin usar el tablero. La pieza sigue siendo una fila de `content_ideas`. Aprobar, publicar en Metricool y devolver un corte a edición siguen en Revisión y Entregas, con una persona.

## Qué hace el pipeline

1. **On Site / grabación.** El videógrafo marca tomas. El material crudo queda en Drive (link) o en el bucket R2 del pipeline.
2. **Edición.** Una persona edita. El corte final se sube a **Entregas R2** (`storage_provider = entregas-r2`), no al bucket de crudos.
3. **IA.** Al subir desde el navegador, el editor manda fotogramas a `POST /api/video-analysis` (visión) y el sistema deja un **borrador** de caption (`caption_draft`). Guardar el caption es lo que lo promueve a `generated_caption`.
4. **Revisión.** Con el corte registrado y `approval_status = submitted`, supervisor u owner aprueban o piden cambios.
5. **Entregas / Recibo / Metricool.** El archivo aprobado es el que se agenda. Este operador no publica.

Hoy el tablero se dispara desde la UI (`/onsite`, `/pipeline`, `/revision`, `/entregas`). La subida a Drive por API no está hecha: `getServiceAccountAccessToken` responde que la implementación está pendiente. Pegar un link de Drive sí funciona.

## URL

La URL que el repo deja escrita es `https://social-dashboard-zeta-orpin.vercel.app` (`SETUP.md` y el fallback de `lib/actions/review-staff.ts`). Si en el servidor existe `NEXT_PUBLIC_SITE_URL`, esa es la base. En local: `http://localhost:3020`.

Hay que confirmar que ese host es el despliegue vivo y que ahí están las variables de abajo. Sin `PIPELINE_OPERATOR_TOKEN` en ese entorno, la ruta responde 503.

## Auth

Todas las rutas de este documento exigen:

```http
Authorization: Bearer <PIPELINE_OPERATOR_TOKEN>
```

`PIPELINE_OPERATOR_TOKEN` es distinto de `CRON_SECRET`. Si el token no está configurado: **503**. Si falta el header o no coincide: **401**. Si falta `SUPABASE_SERVICE_ROLE_KEY`: **503**.

No pongas el valor en el repo, en Slack ni en el comando que quede en un log compartido. En la caja del asistente:

```bash
export BASE="${NEXT_PUBLIC_SITE_URL:-https://social-dashboard-zeta-orpin.vercel.app}"
# PIPELINE_OPERATOR_TOKEN tiene que ser el mismo valor que en el servidor.
```

## Variables (solo nombres)

Obligatorias para esta entrada:

- `PIPELINE_OPERATOR_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Para subir el corte editado:

- `ENTREGAS_R2_ACCOUNT_ID`
- `ENTREGAS_R2_ACCESS_KEY_ID`
- `ENTREGAS_R2_SECRET_ACCESS_KEY`
- `ENTREGAS_R2_BUCKET`

Opcional, link público permanente del corte (Metricool lo usa en otros flujos): `ENTREGAS_R2_PUBLIC_BASE_URL`.

Para reintentar el caption:

- `XAI_API_KEY` (proveedor por defecto) o `ANTHROPIC_API_KEY` si `CAPTION_PROVIDER=claude`
- `CAPTION_PROVIDER` (`grok` o `claude`)
- `GROK_CAPTION_MODEL` (opcional)
- `WHISPERAPI_API_KEY` (opcional; sin ella el caption no oye el audio)
- `METRICOOL_TOKEN`, `METRICOOL_USER_ID` (ejemplos de estilo; no publican)

El QC visual (`GROK_VISION_MODEL`, `POST /api/video-analysis`) sigue exigiendo fotogramas del navegador y una sesión con `video.upload`. Este operador no lo reintenta.

Crudos en el otro bucket (no esta subida): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.

Drive por API, todavía sin implementar: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GDRIVE_ROOT_FOLDER_ID`.

## Empezar un trabajo

`POST /api/pipeline/operator/jobs`

`phase` por defecto es `edited`. Hasta que el corte se registra, la fila queda apartada (`status=descartada`, `theme=operator-hold`) y la respuesta dice `stage: "waiting"` / «Esperando archivo». Así no entra a On Site, Mi Día, el runway, el inventario ni al banco del editor. No es un descarte del equipo. No entra a Revisión hasta el `register` de abajo.

```bash
curl -sS -X POST "$BASE/api/pipeline/operator/jobs" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "11111111-1111-4111-8111-111111111111",
    "title": "Reel de verano",
    "hook": "De qué es el video",
    "publishDate": "2026-10-24",
    "phase": "edited",
    "fileName": "corte.mp4",
    "contentType": "video/mp4"
  }'
```

Respuesta **201** (el `job` también trae `videos`, `outputs`, `caption` y `metricool`):

```json
{
  "job": {
    "id": "JOB_ID",
    "clientId": "11111111-1111-4111-8111-111111111111",
    "clientName": "Cliente",
    "title": "Reel de verano",
    "status": "descartada",
    "approvalStatus": "pending",
    "stage": "waiting",
    "stageLabel": "Esperando archivo",
    "retryable": ["upload", "register"]
  },
  "upload": {
    "url": "https://ACCOUNT.r2.cloudflarestorage.com/...",
    "key": "entregas/JOB_ID/edited/1720000000000-corte.mp4",
    "method": "PUT",
    "headers": { "Content-Type": "video/mp4" }
  }
}
```

Si faltan `ENTREGAS_R2_*`, el trabajo igual se crea y `upload` es `{ "error": "R2 de Entregas no está configurado (faltan ENTREGAS_R2_*)" }`.

Sube el archivo a la URL firmada (caduca en 1 hora) y luego regístralo:

```bash
curl -sS -X PUT -H "Content-Type: video/mp4" --data-binary @corte.mp4 "$UPLOAD_URL"

curl -sS -X POST "$BASE/api/pipeline/operator/jobs/$JOB_ID/retry" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "step": "register",
    "key": "entregas/JOB_ID/edited/1720000000000-corte.mp4",
    "name": "corte.mp4",
    "sizeBytes": 12345,
    "mimeType": "video/mp4"
  }'
```

Con `approval_status=pending`, el registro pasa el trabajo a Revisión (`submitted`). Respuesta **200**:

```json
{
  "videoId": "VIDEO_ID",
  "reviewUnchanged": false,
  "note": "El corte quedó registrado y pasó a revisión.",
  "job": { "stage": "approval", "stageLabel": "Revisión", "approvalStatus": "submitted" }
}
```

La `key` tiene que empezar por `entregas/{id-de-este-trabajo}/edited/`. Máximo 2 GB. Solo `video/*`.

Material crudo (no entra a Revisión): `phase` `raw` y un link de Drive. No se manda `fileName`; el crudo no va al bucket de Entregas.

```bash
curl -sS -X POST "$BASE/api/pipeline/operator/jobs" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "11111111-1111-4111-8111-111111111111",
    "title": "Toma 1",
    "phase": "raw",
    "driveLink": "https://drive.google.com/file/d/FILE_ID/view"
  }'
```

Eso deja `status=grabada` y un video `kind=raw`, `storage_provider=drive`.

## Estado

`GET /api/pipeline/operator/jobs/{id}`

```bash
curl -sS "$BASE/api/pipeline/operator/jobs/$JOB_ID" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN"
```

`stage` sale de la misma función que el tablero de Entregas: `edited` (Editado), `approval` (Revisión), `copy` (Copy), `publication` (Publicación). Un borrador de caption no mueve la etapa. `downloadUrl` es un GET firmado de 1 hora del corte editado vigente en Entregas. Pide el estado otra vez si caducó.

## Listar

`GET /api/pipeline/operator/jobs?clientId={uuid}&limit=20`

`limit` va de 1 a 50. Sin `clientId`, los más recientes. La lista no firma descargas; el detalle sí.

```bash
curl -sS "$BASE/api/pipeline/operator/jobs?clientId=11111111-1111-4111-8111-111111111111&limit=20" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN"
```

```json
{ "count": 1, "jobs": [ { "id": "JOB_ID", "stage": "approval", "outputs": [] } ] }
```

## Reintentar

`POST /api/pipeline/operator/jobs/{id}/retry`

| `step` | Cuándo | Cuerpo extra |
| --- | --- | --- |
| `upload` | Nueva URL firmada. **409** si ya está aprobado, publicado, descartado o en Metricool. | `fileName`, `contentType` |
| `register` | Después de un PUT correcto. En `pending` entra a Revisión. En `revision_needed` o `submitted` guarda el archivo y **no** cambia la revisión. | `key`, `name`, `sizeBytes`, `mimeType` |
| `caption` | Ya hay un video. Hace falta el gancho (`hook`) o un análisis visual previo. Escribe solo `caption_draft`. | ninguno |

```bash
curl -sS -X POST "$BASE/api/pipeline/operator/jobs/$JOB_ID/retry" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "step": "caption" }'
```

**200** incluye `caption` (el borrador) y `job`. **422** si falta el video, el gancho o la IA no respondió. **503** en `upload` si faltan `ENTREGAS_R2_*`.

## Errores

| Código | Significado |
| --- | --- |
| 400 | JSON o campos inválidos |
| 401 | Token ausente o distinto |
| 404 | Cliente o trabajo inexistente |
| 409 | No se puede adjuntar otro corte (aprobado, publicado o cerrado) |
| 422 | El caption no se pudo generar |
| 500 | Error de base |
| 503 | Falta `PIPELINE_OPERATOR_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` o, en la subida, `ENTREGAS_R2_*` |

## Estado actual

- El tablero (ideas, Entregas R2, revisión, caption en borrador, Metricool) es el pipeline que usa el equipo. No hay un render automático dentro de este repo.
- Esta entrada crea y lee ese mismo trabajo. No aprueba ni publica.
- Subir el editado por aquí depende de que Entregas R2 esté configurado en el servidor.
- El QC de visión no se puede relanzar desde aquí: los fotogramas no se guardan y la ruta actual pide sesión de editor.
- Varias migraciones de `docs/TODO.md` (entre ellas `0061_video_analysis.sql`) pueden seguir sin aplicar. El caption se genera igual; el reporte visual no aparece hasta que exista la tabla.
