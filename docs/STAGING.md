# Staging y pruebas E2E

Las pruebas end-to-end **nunca** corren contra producción. Corren contra
**staging**: la app buildeada en `localhost:3021` apuntando a un proyecto
Supabase de staging con datos sembrados.

```
.env.staging  →  next build/start (distDir .next-staging, puerto 3021)  →  Playwright
```

## Montarlo una vez

1. **Proyecto Supabase de staging** (uno aparte del de producción
   `uvphfpqeevmhqmyorhcm`). Aplicarle las migraciones del repo:

   ```bash
   supabase link --project-ref <ref-de-staging>
   supabase db push
   ```

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
| `npm run staging:seed` | Siembra usuario supervisor + `Cliente E2E` + un video entregado esperando revisión (idempotente). |
| `npm run staging:serve` | Buildea y levanta el staging en `http://localhost:3021` (añade `--fresh` para forzar build). |
| `npm run test:e2e` | Siembra y corre toda la suite (levanta el staging solo). |
| `npm run test:e2e:smoke` | Solo las pruebas marcadas `@smoke`. |
| `npm run test:e2e:ui` | Modo interactivo de Playwright. |

El staging usa `distDir` propio (`.next-staging`), así que **se puede levantar
con `next dev` corriendo** — no comparten `.next/`.

## Dónde se exigen

- **Pre-commit** (`.husky/pre-commit`): typecheck → unit → E2E. Un commit no
  entra si un E2E está rojo. Escape para un WIP que no se mergea:
  `SKIP_E2E=1 git commit …`.
- **Merge** (`.github/workflows/e2e.yml`): el job `e2e` corre en cada PR a
  `main`. Es parte de las reglas de `docs/MERGE_RULES.md` — sin él verde, no hay
  merge. El reporte HTML queda como artefacto del run.

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
