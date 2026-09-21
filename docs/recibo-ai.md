# Recibo (clientes AI) + puente humano → pool

## Abrir
- Staff: `/recibo` (menú Trabajo → Recibo). Requiere `entregas.read`.
- Lista clientes con `clients.edit_mode = 'ai'` (intake) y, aparte, el **puente humano**.
- Aprobación del cliente: enlace `/aprobacion/{token}` (generado desde Recibo o Entregas → Enviar al cliente).

## Pool Listo
- **AI:** si el cliente aprueba (Recibo o `/aprobacion`), el video entra solo al **pool** como **Listo**.
- **Humano:** no entra solo. Owner/supervisor pulsa **Enviar al pool · Listo** (permiso `pool.send_human`).

## Gate — no saltar Revisión
El CTA humano **no** se guarda si falta Revisión interna (`content_ideas.approval_status !== 'approved'`).
También exige aprobación del cliente (`staff_client_approval`, `client_review_status` o voto en `entregas_client_review_items`) y `edit_mode = 'human'`.
El servidor (`sendHumanReciboToPool`) aplica el mismo gate; la UI solo lo enseña.

Columna: `content_ideas.staff_pool_ready` (migración `0088`). Nunca se pone sola.

## Migraciones
- `0085_client_edit_mode.sql` — columna `edit_mode` (`ai`|`human`, default `human`).
- `0086_recibo_manual_flags.sql` — `manual_posted_status`, `staff_client_approval`; Arecibo Lab → `ai`; RPC `get_entregas_review` incluye `client_logo_url`.
- `0088_human_recibo_pool.sql` — `staff_pool_ready` (CTA Recibo humano → pool Listo).

## Arecibo Lab
- id `cd02f509-4e1d-49f2-aee7-e59942b16ffd` → `edit_mode='ai'` (migración 0086).
- **No** se asigna editor humano (`assigned_to` se deja como está, hoy `null`).

## Qué no hace
- Auto-post Metricool
- Watermark
- Sobrescribir crudos del Pipeline
- Meter al pool un corte humano sin el CTA (aunque el cliente haya votado)
