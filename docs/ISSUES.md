# Issue log

Updated: 2026-08-08 (America/Puerto_Rico)

This is the local, auditable triage log. Sentry issue IDs are added only after
the external project is configured and an event is verified there. Production
or migration status is never inferred from repository files alone.

| ID | Priority | Status | Area | Evidence | Next action |
|---|---|---|---|---|---|
| NM-001 | P0 | Closed / monitor | Local auth / Supabase | An earlier authenticated session reached `Acceso denegado (perfil no configurado)`. After restart, `/pipeline` rendered successfully with the current profile and live data; the failure is not currently reproducible. | Let Sentry capture recurrence before changing auth or profile data. |
| NM-002 | P1 | Open | Pipeline recording | Full Vitest run: 1,066 pass and 2 fail in `lib/utils/pipeline-recording.test.ts`; pre-caption ideas are counted as ready to record. These files are untracked local work. | Decide the intended readiness rule, then make the implementation and focused tests agree. |
| NM-003 | P1 | Closed / monitor | Observability | Sentry project `nate-media-social-dashboard` exists in org `nathan-thrower`. Local and Vercel Production/Preview/Development environments have DSN/org/project configuration; Vercel also has the scoped source-map token. Release `ba5dc13014891d1b70705b335b03a066830974b2` contains successful Node, Edge, and Client artifact-bundle uploads. Controlled server event `28ba9fd3b74f4c7994a27e5b0a730563` was received as `NATE-MEDIA-SOCIAL-DASHBOARD-2`; controlled browser event `NATE-MEDIA-SOCIAL-DASHBOARD-4` resolved to `app/sentry-example-page/sentry-test-client.tsx`. Setup artifacts `-1` through `-4` are resolved, leaving no unresolved Sentry issues. | Monitor new unresolved issues. Use the read-only token stored in macOS Keychain under `codex-sentry-nate-media-readonly` for API triage. |
| NM-004 | P1 | Review required | Dependency security | `npm audit --omit=dev`: 4 high and 1 moderate production advisories. The suggested Next.js fix is a semver-major upgrade, so no automatic fix was applied. | Review advisories package-by-package and plan a tested Next.js upgrade. |
| NM-005 | P1 | Not verified remotely | Supabase migrations | `docs/TODO.md` records `0043_scene_check.sql` as pending with migration-history drift; older migrations are also listed as pending. | Reconcile the remote migration ledger/schema read-only before applying anything. |
| NM-006 | P2 | Open | Lint baseline | `npm run lint` fails across the existing codebase, mainly unused imports/variables, explicit `any`, unescaped entities, and hook dependency warnings. | Establish the exact lint count and reduce it in small, behavior-preserving batches. |
| NM-007 | P2 | Open | Test quality / accessibility | The full suite emits React `act(...)` warnings and Radix dialog description warnings despite most tests passing. | Fix warnings in focused component batches so regressions remain visible. |
| NM-008 | P2 | Open | Repository state | Web `main` is 15 commits ahead of `origin/main` and contains untracked feature/migration files. | Create a feature branch and explicitly separate publishable work from experiments before the next commit. |

## Sentry verification checklist

- [x] Browser, Node.js, and Edge initialization files exist.
- [x] App Router global and dashboard error boundaries call `captureException`.
- [x] Monitoring disables itself when the DSN is absent.
- [x] Default PII collection and Session Replay are disabled.
- [x] Trace sampling is configurable; production defaults to 10%.
- [x] Source-map upload runs only when org, project, and auth token are present.
- [x] `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, and `SENTRY_PROJECT` configured locally.
- [x] `SENTRY_AUTH_TOKEN` configured in Vercel for source maps.
- [x] Separate read-only token stored in macOS Keychain for issue inspection.
- [x] Controlled server event verified in Sentry.
- [x] Controlled browser event verified in Sentry.
- [x] First Sentry issue IDs linked to this log.
- [x] Node, Edge, and Client source-map uploads verified in release `ba5dc13014891d1b70705b335b03a066830974b2`.
