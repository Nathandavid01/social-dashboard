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
- [ ] **Inc 1** — Core puro `review-link-core.ts` (expiry, url, canReview, labels ES) TDD verde + migración 0042 (columnas + tabla comentarios) escrita.
- [ ] **Inc 2** — Página pública `/review/[token]`: carga video+caption+hilo por token (RPC `get_review_by_token`), player, estado de expiración. Helpers de formato testeados + test RTL. **Negativos:** token malo → 404; token expirado → solo lectura.
- [ ] **Inc 3** — Acciones del cliente validadas por token: `submitClientReview(token, decision, name)` + `addReviewComment(token, kind, name, body)` vía RPC. Core de validación pure-tested; escribe estado + comentario; loguea actividad. **Negativo:** un write con token A NO puede mutar el video B (aislamiento).
- [ ] **Inc 4** — Lado staff en `VideoWorkCard`: botón "Copiar link de revisión" **gateado a que exista video editado** (el Worker R2 solo sirve `/edited/`; sin él el cliente no ve nada) — espeja el gating de `PublishToMetricoolButton`. Genera/regenera token + copia URL para WhatsApp, muestra el voto del cliente + hilo, el staff responde. Voto visible; aprobación interna sigue separada.
- [ ] **e2e real**: abrir un link de un video real, Rechazar+comentar como cliente, ver el voto+comentario en la tarjeta, responder como staff, Aprobar. Gate ×2.
- [ ] Prod: migración 0042 aplicada (SQL Editor `bgqdtfhelknmfudcvrzz`) + `SUPABASE_SERVICE_ROLE_KEY` y `R2_PUBLIC_BASE_URL` verificados en Vercel.

## Shipped
<!-- iteración añade: - <inc> (PR #) — una línea -->

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
