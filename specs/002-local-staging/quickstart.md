# Quickstart: local staging

## Start

```bash
cd "/Users/ericperez/Nate Media/social-dashboard"
npm run dev:staging
```

Open **http://localhost:3022**

Sign in with the staging owner from `.env.staging` (not a production user).

## Prove it is not production

```bash
npx vitest run lib/utils/staging-env.test.ts
```

A URL that is not the staging project ref MUST throw.

## Click-through (approve → same file)

1. Entregas on 3022
2. Open **this week's** card (not last week's)
3. Copy → Enviar a Publicación if ready
4. Confirm Actividad `videoKey` is this week's file

## If the server died

The long-running process times out in this agent. Run the same command again. Do not use `npm run dev` (that can be production-local on 3020).
