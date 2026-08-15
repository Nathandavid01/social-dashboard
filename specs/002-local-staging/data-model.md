# Data model: 002-local-staging

No new tables. Local staging is a **process + env**, not a schema.

## Staging project

- Ref: `mnqgesxmtsxtsajxfesy`
- Isolated from production `bgqdtfhelknmfudcvrzz`
- Same tables as prod (`content_ideas`, videos, clients)

## Local staging server

| Field | Value |
|-------|--------|
| Command | `npm run dev:staging` |
| Port | 3022 |
| Env file | `.env.staging` (gitignored) |
| Dist | `.next-staging-dev` |
| Allowed URL | must include staging project ref |

## States

```text
missing env     → refuse
wrong project   → refuse
port busy       → Next reports error
running         → http://localhost:3022
killed/timeout  → start again with the same command
```
