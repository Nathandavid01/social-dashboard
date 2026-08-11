# Staging y pruebas E2E

Las pruebas end-to-end **nunca** corren contra producción. Corren contra
**staging**: la app buildeada en `localhost:3021` apuntando a un proyecto
Supabase de staging con datos sembrados.

```
.env.staging  →  next build/start (distDir .next-staging, puerto 3021)  →  Playwright
```

## El staging actual

Ya existe: proyecto Supabase **`natemedia-staging`** (`mnqgesxmtsxtsajxfesy`),
creado el 2026-08-11 en la organización *Eric's projects*, plan incluido ($0).

> **Ojo con cuál es producción.** La app real usa `bgqdtfhelknmfudcvrzz` (está en
> `.env.local`). El proyecto `uvphfpqeevmhqmyorhcm` ("NathanDashboard") que sigue
> enlazado en `supabase/.temp/` **no es producción** — solo tiene 3 tablas
> sueltas. `check-staging-env` bloquea los dos por si acaso.

## Montarlo otra vez (o crear otro)

1. **Proyecto Supabase de staging** aparte del de producción. Aplicarle el
   esquema del repo:

   ```bash
   npm run staging:migrate -- --db-url "<url del pooler>" --reset
   ```

   Se usa `scripts/apply-migrations.mjs` y **no** `supabase db push`: el repo
   tiene prefijos de migración repetidos (`0025`, `0034`, `0038` salen dos
   veces) y la CLI los usa como clave única, así que revienta. Este script
   aplica por nombre completo de archivo, en orden alfabético, cada una en su
   transacción, y re-otorga los privilegios de `anon`/`authenticated`/
   `service_role` que `--reset` se lleva por delante.

   La url es la del **pooler** (`aws-0-<región>.pooler.supabase.com:5432`,
   usuario `postgres.<ref>`): la conexión directa `db.<ref>.supabase.co` solo
   responde por IPv6.

2. **`.env.staging`** en la raíz (está en `.gitignore`), copiando
   `env.staging.example`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref-de-staging>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   E2E_USER_EMAIL=e2e@natemedia.test
   E2E_USER_PASSWORD=<una contraseña larga>
   ```

   `npm run check:staging-env` verifica que están todas **y que la URL no es la
   de producción**. Si apunta a prod, falla: un E2E escribiendo en la base real
   ensucia el trabajo del equipo.

3. **Secretos en GitHub** (Settings → Secrets → Actions), para el job `e2e`:
   `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`,
   `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_E2E_USER_EMAIL`,
   `STAGING_E2E_USER_PASSWORD`.

## Día a día

| Comando | Qué hace |
|---|---|
| `npm run staging:migrate -- --db-url <url>` | Aplica las migraciones que falten (idempotente). |
| `npm run staging:seed` | Siembra usuario supervisor + `Cliente E2E` + un video entregado esperando revisión (idempotente). |
| `npm run staging:serve` | Buildea y levanta el staging en `http://localhost:3021` (añade `--fresh` para forzar build). |
| `npm run test:e2e` | Siembra y corre toda la suite (levanta el staging solo). |
| `npm run test:e2e:smoke` | Solo las pruebas marcadas `@smoke`. |
| `npm run test:e2e:ui` | Modo interactivo de Playwright. |

El staging usa `distDir` propio (`.next-staging`), así que **se puede levantar
con `next dev` corriendo** — no comparten `.next/`.

`staging:serve` guarda una huella del código (`app/`, `components/`, `lib/`,
config) y **reconstruye solo si algo cambió**. No es una optimización: sin ella
el staging revivía un build viejo y la suite pasaba sin haber visto el cambio
—comprobado revirtiendo un fix y viendo la suite seguir verde—.

## Dónde se exigen

- **Pre-commit** (`.husky/pre-commit`): typecheck → unit → E2E. Un commit no
  entra si un E2E está rojo. Escape para un WIP que no se mergea:
  `SKIP_E2E=1 git commit …`.
- **Merge** (`.github/workflows/e2e.yml`): el job `e2e` corre en cada PR a
  `main`. Es parte de las reglas de `docs/MERGE_RULES.md` — sin él verde, no hay
  merge. El reporte HTML queda como artefacto del run.

## Smoke de todas las pantallas

`e2e/rutas-smoke.spec.ts` abre **cada ruta de `AREAS`** (la misma lista que el
menú) con el rol del usuario E2E y comprueba: responde <400, no rebota al login,
no cae en la pantalla de error de Next y no tira excepciones de JavaScript.

Una pantalla nueva en `AREAS` entra sola, sin tocar el test. No prueba flujos —
prueba que nada quedó roto de raíz, que es la regresión más común.

Montarlo destapó columnas que existían **solo en la base de producción** (creadas
a mano desde el dashboard) y que ninguna migración creaba: `metricool_blog_id`,
`brand_voice`, `caption_language`, `default_cta`, `caption_notes`,
`default_hashtags`, `default_platforms` — migraciones 0061 y 0062. La app se
callaba el fallo y servía la pantalla sin datos. Si aparece
`column clients.X does not exist` en el log del servidor durante la suite, es
otra columna que falta en el repo: añádela con `if not exists`, no a mano en el
dashboard.

## Escribir una prueba nueva

Van en `e2e/*.spec.ts`. La sesión ya viene iniciada (`e2e/auth.setup.ts` guarda
el login en `e2e/.auth/user.json`), así que un spec empieza directo en la ruta:

```ts
test('@smoke lo que sea', async ({ page }) => {
  await page.goto('/revision')
  …
})
```

Marca `@smoke` lo que tenga que correr en cada commit; lo demás corre completo
en el merge. Si la prueba necesita datos nuevos, siémbralos en
`scripts/seed-staging.mjs` de forma idempotente y con nombre marcado `E2E`.
