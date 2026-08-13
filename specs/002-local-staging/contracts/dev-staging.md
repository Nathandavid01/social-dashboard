# Contract: local staging boot

**Command**: `npm run dev:staging`

**Success**:
- Process listens on `http://localhost:3022`
- `NEXT_PUBLIC_SUPABASE_URL` contains `mnqgesxmtsxtsajxfesy`
- Next dist dir is `.next-staging-dev`

**Failure (exit ≠ 0, nothing listening)**:
- `.env.staging` missing
- URL missing or not the staging project (Spanish error, mention producción / staging)

**Must not**:
- Read `.env.local` as fallback
- Bind port 3020
- Write secrets into git
