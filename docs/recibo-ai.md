# Recibo (clientes AI)

## Abrir
- Staff: `/recibo` (menú Trabajo → Recibo). Requiere `entregas.read`.
- Lista los cortes pendientes de clientes con `clients.edit_mode = 'ai'` **y** (v5.113) cualquier corte pendiente que haya
  subido Eric (`content_idea_videos.uploaded_by` en `ERIC_IDS`, `lib/recibo/board-ideas.ts`), aunque el cliente tenga
  editor humano: solo ese corte, el cliente no cambia de modo.
- Aprobación del cliente: enlace `/aprobacion/{token}` (generado desde Recibo o Entregas → Enviar al cliente).

## Migraciones
- `0085_client_edit_mode.sql` — columna `edit_mode` (`ai`|`human`, default `human`).
- `0086_recibo_manual_flags.sql` — `manual_posted_status`, `staff_client_approval`; Arecibo Lab → `ai`; RPC `get_entregas_review` incluye `client_logo_url`.

## Arecibo Lab
- id `cd02f509-4e1d-49f2-aee7-e59942b16ffd` → `edit_mode='ai'` (migración 0086).
- **No** se asigna editor humano (`assigned_to` se deja como está, hoy `null`).

## Qué no hace
- Auto-post Metricool
- Watermark
- Sobrescribir crudos del Pipeline

### Entregas puntuales y versiones (v5.114)

Los clientes humanos conservan su configuración. Sus cortes de Eric aparecen como «Entrega puntual», con reproducción y caption, sin envío masivo ni borrado de toda la idea desde Recibo; esas acciones siguen en el flujo del cliente. El reproductor envía el ID del corte visible y el servidor rechaza un reemplazo concurrente antes de firmar la URL.
