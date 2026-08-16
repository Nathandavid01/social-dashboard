# De qué es el video (v3.40) — reporte

## Status
Completo. Todo verde: 238 archivos / 2053 tests pasados (3 skipped, línea base), `tsc --noEmit` limpio, `check:db-relationships` OK. No push (rama `eric/de-que-es-el-video` en worktree `sd-dequees`, no tocado `social-dashboard`).

## Commits
1. `be02750` feat(video-analysis): añade `video_topic` al contrato del análisis IA (prompt + parser + merge, puro).
2. `9d28579` feat(db): migración `0064_hook_source.sql` — `content_ideas.hook_source`.
3. `7cf602e` feat(video-analysis): la ruta escribe el hook desde `video_topic` (best-effort, dos UPDATEs separados, antes de encadenar el caption, solo último chunk, nunca pisa hook humano).
4. `535f0f6` feat(actions): `updateIdeaBrief` y `updateIdeaHook` limpian `hook_source` al editar el hook a mano (con guardia anti-pisado en `updateIdeaHook`, que se llama en cada "Generar").
5. `e64e461` feat(ui): marca "escrito por la IA…" en `idea-brief-card.tsx` (donde de verdad se edita), `idea-caption-editor.tsx` (línea de solo lectura) y `copy-overlay.tsx` (input `co-hook`).
6. `eaaa6a9` chore(release): v3.40 — `lib/version.ts`, `CHANGELOG.md`, preview `public/previews/v3.40-de-que-es-el-video.html`.

## Resumen de tests
- Puros (`lib/llm/video-analysis-core.test.ts`): prompt pide `video_topic` con la definición correcta; parser lo conserva/omite tolerante; merge conserva el primero no vacío.
- Ruta (`app/api/video-analysis/route.test.ts`, +5 tests): hook vacío + `video_topic` → escribe hook y `hook_source='ai'` en orden, antes de `generateIdeaCaption`; hook humano → no lo toca; sin `video_topic` → nada; falla el update de `hook_source` → hook igual se guarda y caption se encadena; troceado → solo el último chunk escribe, usando el `video_topic` ya fundido.
- Actions (`content-ideas.test.ts`, `entregas-copy.test.ts`): `updateIdeaBrief` limpia `hook_source` solo cuando `'hook' in fields`, degrada si la columna falta; `updateIdeaHook` compara contra el valor guardado — un "Generar" sin editar nada no toca `hook_source` (evita el trap de pisar la marca en cada regeneración); `getEntregaCopyVideos` trae `hookSource` en un SELECT aparte, best-effort (columna sin migrar → todos `null`, el overlay no se cae).
- UI (`idea-brief-card.test.tsx`, `idea-caption-editor.test.tsx`, `copy-overlay.test.tsx`): marca visible con `hookSource==='ai'`, ausente sin ella, desaparece al **guardar** una edición humana (no al enfocar/abrir). Sin warnings de `act()` nuevos — los que aparecen en la suite son pre-existentes en `CaptionFeedback`/`EnlaceClienteBoton`, no introducidos por este trabajo.

## Fix post-review: TOCTOU en la escritura del hook (Critical)
Commit `0a32b97`. La revisión final encontró que `idea.hook` se leía al principio de la petición y el `update` ocurría después de `analyzeVideoFrames` (llamada a Grok, hasta decenas de segundos) — ventana en la que el editor está viendo la idea recién subida y puede escribir el hook a mano; si lo hacía ahí, se lo pisábamos y lo marcábamos `hook_source:'ai'` por error.

Arreglo: el UPDATE del hook ahora es condicional en la propia query — `.update({ hook: videoTopic }).eq('id', idea_id).is('hook', null).select('id')` — y `hook_source:'ai'` solo se escribe si esa query devolvió una fila. Si no matcheó (alguien escribió mientras tanto), no se toca nada y el caption se encadena igual, leyendo el hook humano ya persistido. Filtro `.is('hook', null)` (no `.or('hook.is.null,hook.eq.')`): confirmado que el hook siempre se normaliza a `null` cuando está vacío en los tres paths de escritura (`content-ideas.ts` línea 163/318, `updateIdeaBrief`, `updateIdeaHook`) — nunca queda como cadena vacía en la práctica.

Tests nuevos en `app/api/video-analysis/route.test.ts` (32 tests, +1 neto sobre lo que había):
- Reescribí "hook con texto humano → NO lo toca" para reflejar el mecanismo real: el mock simula que `.is('hook', null).select('id')` no matchea (`hookUpdateNoMatch = true`), no que la lectura inicial ya viera el hook lleno.
- Añadí el caso TOCTOU explícito: lectura inicial ve el hook vacío, pero el UPDATE condicional no matchea (alguien escribió mientras `analyzeVideoFrames` corría) → asserta (a) `hook_source` nunca se escribe, (b) `hookUpdates` queda vacío (no hay write que gane la carrera), (c) `generateIdeaCaption` se encadena igual.
- Caso feliz sigue cubierto: hook vacío + match → escribe hook y `hook_source:'ai'`.

Verificación: tests enfocados (32/32), `npx tsc --noEmit` limpio, suite completa 238 archivos / 2054 tests (antes 2053 — +1 neto), `check:db-relationships` OK.

## Concerns
- **Migración 0064 pendiente de aplicar en prod** (anotado en `docs/TODO.md`, junto a 0060–0063 que también siguen pendientes según el sondeo del 2026-08-15). Hasta aplicarla: el hook se escribe igual (best-effort), pero la marca "escrito por la IA" no aparece en ningún sitio.
- Pregunté antes de tocar `idea-brief-card.tsx` (no nombrado explícitamente en el spec) porque es donde el hook se edita de verdad — confirmado por el coordinador, implementado en los tres sitios.
- No se tocó `hasVisualAnalysis`/v3.38: sigue siendo la red de seguridad cuando el hook no se pudo escribir (video sin `video_topic`, migración pendiente, etc.).
