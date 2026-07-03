# Nate Media — Pipeline Autoloop (feature)

**North Star:** el mejor pipeline del dashboard para editores/staff, donde
(1) generan **captions automáticos con AI** desde la tarjeta del video, y
(2) **publican DIRECTO a Metricool** desde aquí — programado o inmediato —
con estado visible y sin doble-post. Cada iteración **verifica 2 veces** que
funciona de verdad; si no, lo cambia hasta que sí.

Repo: `/Users/ericbotperez/socialdashboard` · Next.js 14 + Supabase + Metricool + R2.
Gate: `npx tsc --noEmit` (0 errores) + `npx vitest run --exclude '**/.claude/**'`
(verde = solo el flake conocido `sidebar-context.test.tsx` de `localStorage.clear`).
Ship: worktree desde `origin/main` → TDD → PR → review adversarial → merge → Vercel READY → bump `lib/version.ts` + CHANGELOG (ES).

---

## Definition of Done (el loop termina cuando TODO esto está ✅ y 2 iteraciones seguidas no hallan gap real)

- [x] Editor genera caption AI desde la tarjeta del video (mismo engine + learning) — ya existe (`IdeaCaptionEditor` → `generateIdeaCaption`).
- [x] Rol Video puede generar/editar captions; grabación sin bloqueo por caption (v2.83).
- [x] Botón **"Publicar a Metricool"** en la tarjeta del video, gateado `posting.publish` (PR #77, v2.84).
- [x] **Siguiente paso visible por video** (videoNextStep: caption→editado→revisión→aprobado→Metricool→publicado, honesto sobre qué falta) + badge "En Metricool" (PR #77).
- [x] **Auto-post al aprobar operativo en PROD** — 0032 aplicada + Worker R2 vivo (verificado 2026-07-02); el toast de aprobar dice si se programó o por qué no (PR #77).
- [x] Idempotencia sin doble-post verificada (claim atómico `posting_started_at`; review adversarial la confirmó, botón manual + auto-post serializan).
- [x] Chip de **error de publicación** visible en la tarjeta + reintento seguro (PR #78, v2.85).
- [x] Hardening idempotencia: backstop `posted_at` + retry ×3 del bookkeeping sin soltar claim (PR #78).
- [x] "Generar captions de todo el batch" en un clic (PR #78, v2.85).
- [x] Tablero 100% español (columnas + título) (PR #77).
- [ ] Cada feature verificada **2 veces**: gate (tsc+vitest) ×2 + prueba end-to-end del flujo real. (Gate ×2 hecho en PR #77; e2e real de publicar pendiente de un video aprobado real.)

## Prerrequisitos de PROD (verificados 2026-07-02)

- [x] Migración **0032** APLICADA en prod (probe REST → 200 en `metricool_post_id` y `posting_started_at`).
- [x] Worker `nmedia-public-videos` VIVO (solo sirve `/edited/`); `R2_PUBLIC_BASE_URL` en Vercel según memoria (set 2026-06-07).
- [ ] `XAI_API_KEY` en Vercel — sin verificación directa (el MCP de Vercel de Eric no ve el team de Nathan); si un caption falla en prod con "XAI_API_KEY no está configurado", es esto.
- [ ] `metricool_blog_id` por cliente — 48/56 lo tenían (2026-06-07); sin él el video no publica (por diseño). Revisar los faltantes.

---

## Shipped
- Tablero corto de 4 columnas: Video → Edición → Aprobación → Publicación (v2.82, PR #75).
- Caption AI + grabación sin bloqueo en la tarjeta; rol Video con captions.use/edit (v2.83, PR #76).
- Publicación profesional desde la tarjeta: botón Metricool + "qué sigue" por video + approve con feedback + tablero en español (v2.84, PR #77).
- Prerrequisitos de prod VERIFICADOS RESUELTOS 2026-07-02: 0032 aplicada, Worker R2 vivo (auto-post operativo; ya no dormido).
- Cron plan-week: las tarjetas de la semana se abren solas (v2.86, PR #79) + HOTFIX Data Cache (v2.87, PR #80). **E2E verificado en prod: run A creó 154 (39 clientes), runs B y C crearon 0; BD sin duplicados.** El cron diario 5am PR queda activo.
- Tarjeta simple (v2.88, PR #81): sube el video arriba + "¿De qué es este video?" → caption AI con hook-only (estándar idea generator); detalles opcionales colapsados; status bar/next-action coherentes.
- Pipeline pro en la tarjeta: publicar a Metricool + "qué sigue" + tablero español (v2.84, PR #77); error visible + captions de batch + anti doble-post (v2.85, PR #78).

## Rejected (nunca re-proponer — el volante de dirección; Eric poda aquí con el porqué)
<!-- - <idea> — <por qué no> -->

## Ideas (scored value×effort, aún sin construir — el loop añade 3 por iteración)
- Botón "Publicar a Metricool" en la tarjeta con estado — value 9/10, effort 4/10.
- Aplicar 0032 + activar auto-post en prod (prerequisito) — value 10/10, effort 3/10.
- Chip de estado publicación (borrador/programado/publicado/error) — value 8/10, effort 3/10.
- "Generar captions de todo el batch" (loop `generateIdeaCaption`) — value 7/10, effort 3/10.
- Cron auto-creación semanal de tarjetas por cadencia del cliente — value 8/10, effort 6/10.
