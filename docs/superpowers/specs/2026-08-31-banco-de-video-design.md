# Banco de Video (admin) — Diseño

Fecha: 2026-08-31 · Aprobado por Eric en chat (voz). Rama: `eric/banco-video`.

## Qué es

Una página nueva `/banco`, **solo para admins (owner + supervisor)** — Danecha,
Nathan, Erick y Yanel entran por rol. Es la vista global de biblioteca sobre los
**crudos** del pipeline, renderizando el modelo ya existente
`lib/pipeline/video-bank.ts` (`buildVideoBank`), que hasta hoy no tenía UI.

## Bloques

### 1. Banco (pestaña principal)
- Un carril por cliente: logo, nombre, **conteo de videos**, editor asignado.
- Cada crudo = **tile de solo carátula** (primera `thumb_keys`), presignada en
  lote y cargada lazy con IntersectionObserver. Sin carátula → placeholder
  estático, sin fetch. Nunca se carga video. Optimizado para velocidad.
- **Reasignar** la idea completa a otro editor desde el tile (usa
  `reassignVideo(productionTaskId, editorId)`; deshabilitado si
  `productionTaskId` es null).
- **Asignar cliente → editor** desde el header del carril
  (`setClientAssignment`), y ver el orden de trabajo que hereda ese editor.
- Sección **Devueltos**: ideas `isInRevision` con `revision_needed` (viradas
  por el QC IA o por un admin), visibles como cola aparte.
- Colores: tarjetas oscuras profesionales (negro + acento del cliente vía
  `clientCardColor`), nada de fondos blancos/lavados.

### 2. Calendario proyectado (pestaña)
- Proyección pura: ideas **aprobadas y aún no publicadas** por cliente,
  ordenadas determinísticamente (approved más antiguo primero; fallback
  `updated_at`), mapeadas sobre los posting days/time del cliente
  (`lib/utils/posting-schedule.ts`) → fecha teórica en que cada video se
  auto-postearía a Metricool.
- Nota de semántica: el banco muestra crudos PENDIENTES (lo aprobado sale del
  banco); el calendario muestra lo APROBADO en cola. Son poblaciones disjuntas
  a propósito y la UI lo dice.
- No toca Metricool: solo lectura/proyección.

### 3. B-roll y files globales para editores
- En el banco del editor (pipeline), todo editor tiene acceso de
  lectura/descarga a los **b-roll y files de todos los clientes**.
- Los **crudos (raw)** siguen scoped a asignación y el WIP limit sigue vivo —
  con test de regresión.

### 4. WIP dinámico por % de aprobación
- `EDITOR_WIP_LIMIT` fijo (2) pasa a `editorWipLimitFor(stats)` puro:
  base 2; ≥10 aprobados y ≥80% → 3; ≥25 y ≥90% → 4.
- Stats = aprobados vs devueltos del historial del editor (ideas donde es
  asignee de idea o de cliente).

## Permisos
- Nuevo slug `video_bank.read` en `lib/auth/permissions.ts`, solo `supervisor`
  (owner = ALL). Página con `requirePermission('video_bank.read')`.
- Área `{ href: '/banco', label: 'Banco de Video', permission: 'video_bank.read', group: 'Trabajo' }`.
- Presign de carátulas: acción batcheada `getBankCoverUrls(videoIds[])` gated
  por `video_bank.read`.

## Testing
TDD: unit tests por util pura (calendario, WIP, covers) + render tests de la
página/los componentes + regresión de acceso del editor (no ve raw ajeno).
Cierre: `tsc --noEmit`, vitest completo, `check:db-relationships`, bump
`lib/version.ts`, CHANGELOG en español, preview HTML en `public/previews/`.
