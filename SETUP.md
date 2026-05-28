# Setup — features añadidos en esta rama (`feat/client-crm-profile`)

## 1. Migraciones SQL pendientes

Aplica en este orden en tu Supabase (Studio → SQL Editor → pega cada archivo):

| # | Archivo | Qué agrega |
|---|---------|-----------|
| 0012 | `supabase/migrations/0012_client_crm.sql` | Mini-CRM: extiende `clients` con owner/contract/billing/brand_colors/posting_days/last_meeting; nuevas tablas `client_payments`, `client_assets`; buckets Storage `client-assets` (público) y `client-contracts` (privado) |
| 0013 | `supabase/migrations/0013_sent_messages.sql` | Audit log de SMS al owner via Twilio |
| 0014 | `supabase/migrations/0014_notifications.sql` | Notificaciones personales (bell dropdown). Habilita Realtime |
| 0015 | `supabase/migrations/0015_client_posting_time.sql` | `posting_time` + `posting_schedule` jsonb en clientes |
| 0016 | `supabase/migrations/0016_workflow_planning.sql` | `workflow_settings` singleton + GPS (`location_lat/lng/address`) en `recording_sessions` |
| 0017 | `supabase/migrations/0017_rbac.sql` | Extiende enum `user_role` con `editor` / `video` / `supervisor`; migra `team_member` → `editor` |
| 0018 | `supabase/migrations/0018_nav_preferences.sql` | `profiles.nav_preferences` jsonb (sidebar movible per-user) |
| 0019 | `supabase/migrations/0019_content_idea_videos.sql` | Tabla `content_idea_videos` (raw + edited por idea, vía Drive) |
| 0020 | `supabase/migrations/0020_rescheduling_trigger.sql` | Trigger: notifica "reagenda" al completar una sesión sin próxima futura |

> Nota: 0017 hace un `commit` intermedio porque Postgres no deja usar valores de enum recién creados en la misma transacción. Aplícalo en su propia ventana en el SQL Editor.

## 2. Variables de entorno

Agrega a `.env.local`:

```env
# Twilio (SMS al owner — task #10)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1787...
# Opcional: TWILIO_MESSAGING_SERVICE_SID=MG...

# Metricool — corregido para usar /admin/simpleProfiles
# El METRICOOL_USER_ID es el id numérico (3746997 para nate.media.pr@gmail.com)
METRICOOL_USER_ID=3746997
METRICOOL_TOKEN=...  (ya estaba)

# Google Drive (solo cuando decidas modo OAuth o service-account — task #23)
# Por ahora la app usa modo "pegar link" que no necesita auth.
```

## 3. Smoke test

Arranca el dev y verifica:

```bash
npm run dev -- -p 3020   # si tienes 3000 ocupado por la rama principal
```

Visita en orden:

- `/home` — banner planning persistente arriba, sin la fila de 11 KPI cards (eliminada)
- `/planning` — board agrupado (Reagendar / Sin agendar / Faltan ideas / Listo)
- `/clients/cadence` — tabla con 49 blogs de Metricool, botón "Auto-aplicar a todos"
- `/clients/<id>` — perfil tabbed: Resumen / Marca / Contrato / Pagos / Assets / Tareas / Contenido
- `/recording-calendar` — nuevo form con GPS picker ("Usar mi ubicación")
- `/team` — pills clickables de rol por persona (solo Owners pueden editar)
- `/settings/workflow` — configuración del workflow (Owner-only)

## 4. Roles y permisos

| Rol | Acceso resumido |
|---|---|
| **owner** | Todo (`*`) |
| **supervisor** | Equipo + contenido + lee billing/contratos (no edita) |
| **editor** | Contenido + captions + marca; sin billing |
| **video** | Calendario grabación + Video QC + uploads; sin marca/billing |

Cada feature futura DEBE registrar su `Permission` en `lib/auth/permissions.ts`. Ver `CLAUDE.md` del proyecto.

## 5. Lo que sigue (decisiones pendientes)

- **Drive nativo (#23)**: hoy el equipo sube manual a Drive y pega link. Si quieres upload directo desde la app: confirma modo **service-account** (folder compartido) vs **OAuth personal** (Drive de cada user). Recomiendo service-account.
- **Workflow settings**: revisa los defaults en `/settings/workflow` y ajusta `min_ideas_per_session` y `ideas_multiplier` a tu cadencia real.

## 6. Mergear a `eric/dev`

```bash
git checkout eric/dev
git merge feat/client-crm-profile
```

(Conviene revisar `git log feat/client-crm-profile --oneline` y/o hacer PR primero. El branch no tiene commits aún — todos los cambios están como working-tree changes en el worktree.)
