# Perf lote 1 — reporte

Worktree: `/Users/ericperez/Nate Media/sd-perf`, rama `eric/perf-audit`.

Rebaseada sobre `origin/main` (`d6a2fa6`, v3.41 "Copiar, abrir y bajar desde la tarjeta") tras la
revisión final — la rama había salido de v3.39 y su diff borraba esa feature. Ver "Rebase" abajo.

## Tabla antes → después (First Load JS)

Medido con `npx next build` sobre el resultado final (rebaseado sobre v3.41), no sobre el commit base
original de la rama:

| Ruta | Antes (base v3.39, dado por el coordinador) | Después (v3.41 + lote 1) | Δ |
|---|---:|---:|---:|
| `/home` | 408 kB | 303 kB | **−105 kB (−25.7%)** |
| `/performance` | 352 kB | 233 kB | **−119 kB (−33.8%)** |
| `/operations` | 401 kB | 402 kB | +1 kB (ruido) |
| `/inbox` | 333 kB | 333 kB | sin cambio |
| `/planning` | 331 kB | 331 kB | sin cambio |
| `/entregas` | — (no medido en la base) | 299 kB | — |
| Compartido por TODA página | 210 kB | 210 kB | sin cambio |
| Middleware | 150 kB | 150 kB | sin cambio (esperado, no se tocó) |

Los números por ruta son idénticos antes y después del rebase (v3.41 solo toca `entregas-board.tsx`
y archivos nuevos de `enlace-cliente-boton`, que no aportan peso a `/home`, `/performance`,
`/operations`, `/inbox` ni `/planning`).

**Todo el ahorro medido viene de recharts (punto 2), no de react-markdown (punto 1).** Ver la
corrección de la revisión final en la sección siguiente — se deja como hallazgo explícito, no se
diluye.

## Corrección de revisión (hallazgo #2 del coordinador): react-markdown ya estaba aislado

La revisión final rebuildeó el commit base (antes del lote) y comparó `app-build-manifest.json`: el
chunk con `react-markdown`/`remark-gfm` **ya estaba fuera del First Load JS de todas las rutas del
dashboard antes de este cambio** — Next ya lo aislaba en un chunk propio de `ChatBubble`, cargado
aparte. Esto es consistente con lo que se observa en la tabla: `/operations`, `/inbox` y `/planning`
(que también montan `ChatBubble` vía el layout compartido) no bajaron ni un KB, mientras que `/home`
y `/performance` — las únicas rutas que montan `recharts` directamente — sí.

**Conclusión:** el cambio del punto 1 (extraer `ChatMarkdown` y cargarlo con `next/dynamic`) no es
dañino ni se revierte — es una **guarda preventiva razonable**: si en el futuro alguien vuelve a
importar `react-markdown` de forma estática en un archivo que sí se cuela en el chunk compartido, el
test de invariante (`chat-bubble.static-imports.test.ts`) lo atrapa antes de que rompa el
aislamiento. Pero **no fue correctivo** — no había ningún KB que ahorrar ahí. El CHANGELOG (v3.43) se
corrigió para no afirmar esa mejora inexistente; ya no menciona el chat.

## Cambios aplicados

1. **ChatBubble / react-markdown** (preventivo, no aportó KB medibles — ver corrección arriba):
   extraído a `components/chat/chat-markdown.tsx`, cargado con `next/dynamic({ ssr:false })` desde
   `chat-bubble.tsx`. Fallback mínimo (barra pulsante) mientras carga el chunk.
2. **recharts** (esta es la mejora real, −105/−119 kB): extraído de `weekly-compliance-card.tsx` →
   `weekly-compliance-chart.tsx`; de `engagement-chart.tsx` → `engagement-bar-chart.tsx`; de
   `platform-breakdown.tsx` → `platform-pie-chart.tsx`. Los tres cargan con
   `next/dynamic({ ssr:false })` y fallback `<Skeleton>` que reserva la misma altura (`chartHeight` /
   280px) — sin salto de layout.
3. **next.config.mjs**: `experimental.optimizePackageImports` con
   `['recharts','@dnd-kit/core','@dnd-kit/sortable','react-markdown']`. `images.remotePatterns` con
   los DOS hosts confirmados en el repo/.env.local: `bgqdtfhelknmfudcvrzz.supabase.co` (Supabase
   Storage, `NEXT_PUBLIC_SUPABASE_URL`) y `pub-b4f609f9a23747649ed8bc1e9cb43be0.r2.dev`
   (`ENTREGAS_R2_PUBLIC_BASE_URL`). **No incluido**: `videos.natemedia.com` — solo aparece como
   fixture de test en `lib/integrations/r2.test.ts`, no como valor real configurado
   (`R2_PUBLIC_BASE_URL` está vacío en `.env.local`); tampoco un host de Metricool (no aparece ningún
   literal en el repo). Por instrucción explícita del coordinador: preferible sin esos hosts a
   inventarlos.
4. **`<img>` sin CLS**: `width`/`height`/`loading="lazy"`/`decoding="async"` en `client-logo.tsx`,
   `entregas-board.tsx:632`, `content-pipeline-board.tsx:481`, `published-feed.tsx:108,156`,
   `content-calendar.tsx:152`, `todays-posts.tsx:85`, `upcoming-schedule.tsx:108`. No se migró a
   `next/image` (fuera de este lote, por instrucción).
5. **`content-visibility`**: añadido `[content-visibility:auto] [contain-intrinsic-size:0_220px]`
   (tarjetas "planificado") y `[contain-intrinsic-size:0_260px]` (tarjetas de batch, más contenido) a
   las 4 `<article>` de tarjeta en `entregas-board.tsx` (líneas 526 y 671) y
   `content-pipeline-board.tsx` (líneas 364 y 601). Verificado que no rompe el scroll vertical por
   columna (`overflow-y-auto`) ni el panning horizontal del tablero (`overflow-x-auto`), ni los
   botones Abrir/Bajar/Copiar de v3.41 dentro de esas mismas tarjetas.
6. **`app/page.tsx`: NO TOCADO, a propósito.** Ver "Item 6" abajo.
7. **Fuentes muertas**: borrados `app/fonts/GeistVF.woff` y `GeistMonoVF.woff` (sin referencias en el
   repo — grep confirmado antes de borrar; el layout usa `Inter` de `next/font/google`).

## Item 6 (app/page.tsx) — decidido con el coordinador: NO se toca

Los tokens de recuperación de contraseña llegan solo en el fragmento de la URL
(`#access_token=...&type=recovery`), que **nunca llega a ningún servidor** (ni server component, ni
middleware, ni edge). `RecoveryPasswordForm` (en `/update-password`) parsea ese hash a mano y llama
`setSession` — no hay auto-consumo genérico por `@supabase/ssr`. Cualquier `redirect()` incondicional
desde el servidor haría que el fragmento viaje `/ → /mi-dia → /login` (usuario no autenticado) y se
pierda ahí, rompiendo la recuperación de contraseña sin error visible — un fallo silencioso en un
flujo de cuenta, difícil de reproducir y de detectar. El ahorro posible (evitar un round-trip en una
sola navegación, y solo para el caso de usuario ya logueado) no justificaba ese riesgo. Decisión del
coordinador: dejarlo fuera del lote.

## Rebase sobre v3.41 (post-revisión)

La rama había salido de `32445a7` (v3.39); mientras tanto `origin/main` avanzó con `d6a2fa6` — v3.41
"Copiar, abrir y bajar desde la tarjeta de enlace" (#111). El diff original de la rama contra
`main` borraba esa feature completa (`enlace-cliente-boton.tsx` volvía a la versión sin botones,
`enlace-cliente-boton.test.tsx` desaparecía, `getEntregaVideoEditado`/`getEntregasDownloadUrl` se
borraban de `lib/actions/entregas-r2.ts`, el preview y el bloque de CHANGELOG de v3.41
desaparecían).

Se corrigió con `git fetch origin && git rebase origin/main`. Los 4 commits de código (puntos 1–5,7)
aplicaron **limpios** — sin conflicto — porque no tocan los mismos archivos que v3.41 salvo
`entregas-board.tsx`/`content-pipeline-board.tsx`, donde el `content-visibility` y los atributos de
`<img>` no chocan con los cambios de v3.41 en esos mismos archivos. Solo el commit final (versión +
CHANGELOG + este reporte) tuvo conflicto, resuelto a mano:

- `lib/version.ts` → se queda en `'3.43'`.
- `CHANGELOG.md` → el bloque `## v3.43` (lote 1) queda **encima** del `## v3.41` que ya traía main;
  ninguno de los dos se sustituye.

Verificado a mano después del rebase (no solo confiado al merge automático): los botones Abrir/Bajar
siguen en `enlace-cliente-boton.tsx`, su archivo de test (`enlace-cliente-boton.test.tsx`) sigue
completo, las dos funciones en `lib/actions/entregas-r2.ts` siguen presentes, el preview
`public/previews/v3.41-enlace-acciones.html` sigue existiendo, y `entregas-board.test.tsx` conserva
sus mocks de `entregas-r2`/`entregas-client-review` para `EnlaceClienteBoton`.

## Tests

- Añadidos: `components/chat/chat-bubble.static-imports.test.ts` (invariante: no import estático de
  `react-markdown`/`remark-gfm`, sí `next/dynamic`), `components/home/weekly-compliance-card.static-imports.test.ts`
  (invariante equivalente para `recharts`). Ambos confirmados rojos antes del refactor, verdes
  después.
- `npx vitest run --exclude '**/.claude/**'` (post-rebase): **241 archivos, 2037 tests, todo verde**
  (sube de 240/2029 porque el rebase trae los tests de v3.41, incluido `enlace-cliente-boton.test.tsx`).
  Incluye `entregas-board.test.tsx` y `content-pipeline-board.test.tsx`, que seleccionan
  `article img[alt=""]`/`article img[src*=...]` — no se rompieron por los nuevos atributos, y sus
  mocks de la feature v3.41 siguen intactos.
- `npx tsc --noEmit`: sin errores.
- `npm run check:db-relationships`: OK.

## Commits

En `eric/perf-audit`, rebaseada sobre `origin/main` (v3.41), sin push, sin merge (worktree aislado
por instrucción).
