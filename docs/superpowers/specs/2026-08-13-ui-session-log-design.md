# Log de sesión (clicks + rutas) — diseño

Fecha: 2026-08-13  
Estado: aprobado (enfoque + schema + captura). Implementación en `eric/ui-session-log`.

## Objetivo

Dentro de `/actividad`, el owner ve un tab **Sesión** con clicks y cambios de ruta de cualquier usuario autenticado, por defecto **hoy** (`America/Puerto_Rico`) y **su propio usuario**. Replica el rastro de Sentry sin salir del dashboard. No hay video replay.

## Datos

Tabla `ui_events`: `id`, `user_id` (FK profiles), `kind` (`click`|`navigate`), `path`, `label` (≤80), `target` (nullable), `created_at`.

Índices: `(created_at desc)`, `(user_id, created_at desc)`.

RLS append-only: insert solo `auth.uid() = user_id`; select solo `profiles.role = 'owner'`; sin update/delete por RLS. El cron de prune usa service role.

Retención: 7 días. Cron diario `/api/cron/ui-events-prune`.

## Captura

Tracker montado en el layout autenticado (`DashboardProviders`) si hay usuario.

- `navigate`: cada cambio de `pathname`.
- `click`: `button`, `a`, `[role=button]`, `[data-log]`. Label = `data-log` → `aria-label` → texto, recortado a 80.
- Nunca valores de `input` / `textarea` / `select`.
- Ignorar `/actividad` y `[data-ui-events-ignore]`.
- Dedupe `kind+path+label` < 400 ms.
- Cola en memoria; flush cada 5 s o 20 eventos, y en `pagehide`.
- `POST /api/ui-events` pisa `user_id` con `auth.uid()`. Batch máx. 40. Fallo de red no rompe la UI.

## UI

`/actividad` sigue gated por `activity.read`. Tab Sesión solo si `getCurrentRole() === 'owner'` (también `assertOwner()` en `getUiEvents`). Non-owner ve el feed de pipeline como hoy.

Sesión: chips por persona, default = usuario actual, vacío en español.

## Staging (gate de done)

No se declara listo en local. Aplicar `0059_ui_events.sql` a `natemedia-staging`, entrar como owner, clickear fuera de Actividad, abrir tab Sesión y ver las filas. Non-owner no ve el tab. No merge a `main` sin ese walkthrough.

## Fuera de alcance

Replay de video, pull de sentry.io, IP, user-agent, coordenadas, session-id, jsonb extra.
