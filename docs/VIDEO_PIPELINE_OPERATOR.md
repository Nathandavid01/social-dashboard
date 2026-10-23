# Operador del Pipeline de videos

Entrada HTTP del tab **Pipeline de videos** en **Video QC** (`/video-reviews`). Sirve para ver esos videos, subir el corte editado y reintentar el caption, sin abrir el tablero.

Esa pantalla es la que el menú llama **Video QC** (grupo Desarrollo). El tab por defecto es **Pipeline de videos**. La pestaña **Editores** es la cola: hay material crudo y todavía no hay corte. **Tablero de revisiones** es otra pestaña de la misma página y este operador no la usa.

No es el tablero **Pipeline** (`/pipeline`), ni Revisión, ni Entregas. No crea ideas, no sube crudo ni b-roll, no cambia el estado de la idea y no la manda a revisión.

## Qué muestra el tab

Cada fila es una idea de contenido con sus archivos (crudo, b-roll, editado). Las etapas, en este orden, son las mismas que la fila:

1. **Idea** — hay gancho.
2. **Material** — al menos un crudo activo (la cuenta se ve como n/4).
3. **Editado** — al menos un corte activo (n/2).
4. **Banco** — el cliente tiene algún asset.
5. **Aprobación** — la idea está aprobada. Mientras no, se ve Sin enviar / En revisión / Cambios.
6. **Caption** — hay `generated_caption`. Un borrador en `caption_draft` no completa esta etapa.
7. **Publicado** — hay `published_at`.

Hoy una persona abre `/video-reviews`. En **Editores** (quien tiene permiso de subir video) descarga el material y pulsa **Subir video editado**: el archivo va al bucket R2 del pipeline (`ideas/{ideaId}/edited/…`, `storage_provider = r2`). Este operador hace esa subida y el registro del archivo. No mueve la idea a `producida` ni a `submitted`, así que no entra a Revisión ni sale del banco de crudos por un cambio de estado.

El inventario cuenta cualquier corte editado usable como «listo». Es la regla que ya tiene un archivo editado, también si se sube desde la tarjeta.

Filas viejas con `theme = operator-hold` son el contrato retirado. Esta API no las lista ni las modifica.

## URL

La URL que el repo deja escrita es `https://social-dashboard-zeta-orpin.vercel.app` (`SETUP.md` y el fallback de `lib/actions/review-staff.ts`). Si en el servidor existe `NEXT_PUBLIC_SITE_URL`, esa es la base. En local: `http://localhost:3020`.

## Auth

```http
Authorization: Bearer <PIPELINE_OPERATOR_TOKEN>
```

`PIPELINE_OPERATOR_TOKEN` es distinto de `CRON_SECRET`. Si el token no está configurado: **503**. Si falta el header o no coincide: **401**. Si falta `SUPABASE_SERVICE_ROLE_KEY`: **503**.

No pongas el valor en el repo, en Slack ni en un comando que quede en un log compartido.

```bash
export BASE="${NEXT_PUBLIC_SITE_URL:-https://social-dashboard-zeta-orpin.vercel.app}"
# PIPELINE_OPERATOR_TOKEN tiene que ser el mismo valor que en el servidor.
```

## Variables (solo nombres)

Obligatorias para esta entrada:

- `PIPELINE_OPERATOR_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Para subir y descargar el corte en el bucket del pipeline:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (si falta el nombre, el código usa `nmedia-videos`)

Opcional, URL pública de otros flujos: `R2_PUBLIC_BASE_URL`. Esta subida no la necesita; usa una URL firmada de una hora.

Para reintentar el caption (solo escribe `caption_draft`):

- `XAI_API_KEY` (proveedor por defecto) o `ANTHROPIC_API_KEY` si `CAPTION_PROVIDER=claude`
- `CAPTION_PROVIDER` (`grok` o `claude`)
- `GROK_CAPTION_MODEL` (opcional)
- `WHISPERAPI_API_KEY` (opcional; sin ella el caption no oye el audio)
- `METRICOOL_TOKEN`, `METRICOOL_USER_ID` (ejemplos de estilo; no publican)

El QC visual (`GROK_VISION_MODEL`, `POST /api/video-analysis`) sigue exigiendo fotogramas del navegador y una sesión con `video.upload`. Este operador no lo reintenta.

`ENTREGAS_R2_*` no es el bucket de esta pantalla.

## Listar

`GET /api/pipeline/operator/jobs`

Query opcional:

- `clientId` — UUID del cliente
- `queue=todos` (default) o `queue=editores` (la cola: crudo activo, sin corte, no descartada)
- `limit` — entero de 1 a 50, default 20

```bash
curl -sS "$BASE/api/pipeline/operator/jobs?queue=editores&limit=5" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN"
```

```json
{
  "count": 1,
  "items": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "clientId": "11111111-1111-4111-8111-111111111111",
      "clientName": "La Güira",
      "title": "Reel de verano",
      "contentType": "R",
      "contentTypeLabel": "Reel",
      "status": "grabada",
      "statusLabel": "Grabada",
      "approvalStatus": "pending",
      "approvalLabel": "Sin enviar",
      "readyToEdit": true,
      "stageLabel": "Editado",
      "slots": { "raw": 1, "broll": 0, "edited": 0 },
      "progress": {
        "completed": 2,
        "total": 7,
        "percent": 29,
        "missing": ["Editado", "Banco", "Aprobación", "Caption", "Publicado"]
      },
      "caption": { "draft": null, "generated": null },
      "outputs": [
        {
          "kind": "raw",
          "label": "crudo.mp4",
          "videoId": "raw-1",
          "provider": "r2",
          "href": null
        }
      ],
      "retryable": ["upload", "register", "caption"]
    }
  ]
}
```

En el listado, `href` solo viene lleno en archivos de Drive. La URL firmada de R2 está en el GET de un video.

## Ver uno

`GET /api/pipeline/operator/jobs/{ideaId}`

Misma forma, dentro de `{ "item": { ... } }`. Cada archivo `storage_provider = r2` trae `href` firmado por una hora (descarga con el nombre del archivo). **404** si no existe o si es una fila `operator-hold`.

```bash
curl -sS "$BASE/api/pipeline/operator/jobs/22222222-2222-4222-8222-222222222222" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN"
```

## Subir el corte

`POST /api/pipeline/operator/jobs`

No crea la idea. El video ya tiene que estar en el tab y en la cola de Editores.

```bash
curl -sS -X POST "$BASE/api/pipeline/operator/jobs" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ideaId": "22222222-2222-4222-8222-222222222222",
    "fileName": "corte.mp4",
    "contentType": "video/mp4"
  }'
```

`kind` se puede omitir. Si se manda, tiene que ser `edited`.

```json
{
  "item": { "id": "22222222-2222-4222-8222-222222222222", "readyToEdit": true },
  "upload": {
    "url": "https://…r2.cloudflarestorage.com/…",
    "key": "ideas/22222222-2222-4222-8222-222222222222/edited/1710000000000-corte.mp4",
    "method": "PUT",
    "headers": { "Content-Type": "video/mp4" }
  }
}
```

Después, el PUT del archivo (máximo 5 GB). La URL firmada dura una hora.

```bash
curl -sS -X PUT -H "Content-Type: video/mp4" \
  --data-binary @corte.mp4 \
  "$UPLOAD_URL"
```

**404** si ese id no está en Pipeline de videos. **409** si no está en Editores (sin crudo, ya tiene corte, descartada, aprobada o publicada). **503** si faltan `R2_*`. **400** si el cuerpo es el contrato viejo (cliente + título, sin `ideaId`).

## Registrar el archivo

Cuando el PUT respondió 200, registra esa key. No cambies el estado de la idea.

`POST /api/pipeline/operator/jobs/{ideaId}/retry`

```bash
curl -sS -X POST "$BASE/api/pipeline/operator/jobs/22222222-2222-4222-8222-222222222222/retry" \
  -H "Authorization: Bearer $PIPELINE_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "step": "register",
    "key": "ideas/22222222-2222-4222-8222-222222222222/edited/1710000000000-corte.mp4",
    "name": "corte.mp4",
    "sizeBytes": 1048576,
    "mimeType": "video/mp4"
  }'
```

```json
{
  "videoId": "…",
  "note": "El corte quedó en Pipeline de videos. La idea no cambió de estado y no entró a Revisión.",
  "item": { "readyToEdit": false, "slots": { "raw": 1, "broll": 0, "edited": 1 } }
}
```

La key tiene que ser exactamente `ideas/{ideaId}/edited/{archivo}` de esa URL. `sizeBytes` es un entero entre 1 y 5 GB. `name` es obligatorio.

## Reintentos

El mismo `POST …/retry`.

Otra URL de subida, si la anterior venció y el corte todavía no está registrado:

```json
{ "step": "upload", "fileName": "corte.mp4", "contentType": "video/mp4" }
```

Caption. Solo guarda el borrador. La etapa Caption del tab sigue en falta hasta que alguien guarde `generated_caption` en la ficha.

```json
{ "step": "caption" }
```

```json
{
  "caption": "Texto del borrador…",
  "note": "El borrador quedó en caption_draft. La etapa Caption del tab usa generated_caption y no se promueve aquí."
}
```

`retryable` en el item dice cuáles de `upload`, `register` y `caption` aplican ahora.

## Qué no hace

- No aprueba, no publica en Metricool y no pulsa «Enviar a revisión».
- No crea ideas ni adjunta crudo o b-roll. Eso sigue en On Site y en la ficha.
- No promueve el caption a la etapa Caption del tab.
- No reintenta el QC visual.
