# Nate Media — Portal de Aprobación del Cliente (feature autoloop)

**North Star:** funcionar como agencia profesional (estilo Frame.io). El staff
copia un **link de revisión** por video y lo manda por WhatsApp. El cliente abre
el link **sin login**, ve el video editado + caption, y puede **Aprobar /
Rechazar / Comentar** en un **hilo** (cliente + staff responden). El voto del
cliente aparece en la tarjeta del pipeline; **un humano del staff da el OK final
y publica** (dos capas — el cliente NO dispara Metricool).

Repo: `/Users/ericbotperez/socialdashboard` · Next.js 14 + Supabase + R2.
Gate por incremento: `npx tsc --noEmit` (0 errores) + `npx vitest run` (verde =
solo el flake conocido `sidebar-context.test.tsx`).
Ship: worktree desde `origin/main` → **TDD (test primero, falla, luego implementa)** →
PR → review adversarial → merge → Vercel READY → bump `lib/version.ts` + CHANGELOG (ES).

**Regla del loop:** SOLO se construyen ideas **value 10/10**. Si una idea no es
10, va a `## Ideas` con su score y NO se implementa hasta que Eric la suba a 10.

## Decisiones de producto (fijadas 2026-07-04 — NO re-preguntar)
- Cliente puede: **Aprobar / Rechazar / Comentar** (3 estados: pending/approved/rejected).
- Al aprobar: **registra el voto del cliente**; el staff hace la aprobación interna
  (`approveIdea`, `video.approve`) y dispara Metricool. El cliente NUNCA publica.
- Comentarios: **hilo** (`video_review_comments`, author_kind = client|staff).
- Link: **token que expira (30 días)**, regenerable por el staff.

## Arquitectura decidida
- Ruta pública nueva: `app/(review)/review/[token]/page.tsx` (sin auth — el grupo
  `(portal)` es el precedente; el middleware no bloquea rutas nuevas).
- Escrituras del cliente sin sesión: **RPCs `SECURITY DEFINER` keyed por token**
  (`submit_client_review`, `add_review_comment`, `get_review_by_token`) — la BD
  filtra por `review_token` y solo toca ESA fila + sus comentarios (invariante de
  scoping DB-enforced, no a ojo). Nunca exponer el service-role al cliente; el
  cliente NUNCA escribe `approval_status` (firewall con la aprobación interna).
- Video editado servido por el Worker R2 público (`getR2PublicUrl` / `R2_PUBLIC_BASE_URL`).
- Lógica pura y testeable en `lib/utils/review-link-core.ts` (sin red).
- Migración `0042`: columnas de review en `content_ideas` + tabla `video_review_comments`.
  Escrita defensivamente (lecturas con `select('*')` degradan si no está aplicada).

## Definition of Done (el loop termina cuando TODO esto está ✅ + e2e real verificado)
- [x] **Inc 1** — Core puro `review-link-core.ts` TDD + migración 0042. ✅ PR #83, v2.89
- [x] **Inc 2** — Página pública `/review/[token]` (video+caption+hilo+expiración; token malo→404, expirado→solo lectura). ✅ PR #84, v2.90
- [x] **Inc 3** — Acciones del cliente (Aprobar/Rechazar/Comentar) validadas por token, form `ReviewActions`. ✅ PR #85, v2.91
- [x] **Inc 4** — Lado staff `ReviewLinkPanel` (generar/copiar link gateado a video editado + `posting.publish`, token CSPRNG, voto+hilo+respuesta). ✅ PR #86, v2.92
- [ ] **e2e real** (gated en 0042 en prod): subir video editado → Generar link → abrir → Rechazar+comentar como cliente → ver voto+comentario en la tarjeta → responder como staff → Aprobar.
- [ ] Prod: migración 0042 aplicada (SQL Editor `bgqdtfhelknmfudcvrzz`) + `SUPABASE_SERVICE_ROLE_KEY`/`R2_PUBLIC_BASE_URL`/`NEXT_PUBLIC_SITE_URL` en Vercel.

## Shipped — FEATURE COMPLETO end-to-end (Inc 1–4)
- **Inc 1** (PR #83, v2.89) — core puro (21 tests) + migración 0042 (columnas + tabla `video_review_comments` + 3 RPCs SECURITY DEFINER keyed por token). Hardening: notify pgrst, caps, log solo en cambio.
- **Inc 2** (PR #84, v2.90) — página pública read-only, `lib/supabase/public.ts` (anon), `getReviewByToken`. 0 HIGH.
- **Inc 3** (PR #85, v2.91) — acciones cliente + `ReviewActions`. Validación doble capa, expiración server-side. 0 HIGH.
- **Inc 4** (PR #86, v2.92) — `ReviewLinkPanel` staff + `review-staff.ts`. 0 HIGH + hardening (excluir archivados, `NEXT_PUBLIC_SITE_URL`).

## ⚠️ HANDOFF para encender en PROD (lo único que falta)
1. Aplicar migración `0042` en el SQL Editor (proyecto `bgqdtfhelknmfudcvrzz`) — el MCP no ve el team de Nathan.
2. Verificar/​setear en Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `R2_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`.
3. Correr el e2e real de arriba.

## Rejected (nunca re-proponer — Eric poda aquí con el porqué)
<!-- - <idea> — <por qué no> -->

## Ideas (scored value×effort — solo se construyen las de value 10)
- Portal de aprobación del cliente por link (Aprobar/Rechazar/Comentar + hilo) — **value 10/10**, effort 7/10 (dividido en Inc 1–4). ← EN CURSO
- Notificar al staff (push/WhatsApp) cuando el cliente vota o comenta — value 8/10, effort 4/10.
- Ver el link/QR embebido para pegar en WhatsApp con preview OG — value 6/10, effort 4/10.
- Historial de versiones del video (v1/v2) en el mismo link de revisión — value 7/10, effort 8/10.
- Marcar comentarios como resueltos (resolver hilo) — value 6/10, effort 3/10.
- **Rate-limit / abuse-guard en escrituras de review** (cualquiera con el link puede
  spamear comentarios) — value 6/10, effort 3/10. **GAP CONOCIDO-DIFERIDO**: en v1
  token+expiry por write es suficiente; NO está cubierto en Inc 1–4.
