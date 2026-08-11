# Hard merge rules (Nate Media Social Dashboard)

These rules exist so **Nathan, Eric, or any contributor** cannot land broken storage/UI work on `main` by accident.

## Absolute rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **No direct push to `main`** | Branch protection / ruleset (repo admin) |
| 2 | **Every change lands via Pull Request** | Same |
| 3 | **PR must be verified** — required status checks green | GitHub required checks |
| 4 | **Graph model must pass** — ordered check graph in `scripts/merge-gate.mjs` | CI job **`merge-gate`** |
| 5 | **E2E en staging verdes** — la suite de Playwright contra staging | CI job **`e2e`** |
| 6 | **≥1 approving review** before merge | Branch protection |
| 7 | **Conversations resolved** before merge | Branch protection |

### Graph model (what “verified” means)

```
static-db-relationships
        ↓
unit-core-guards  (relationships + dual-R2 + migration plan + schema mocks)
        ↓
r2-inventory-dry-run  (lists remaining pipeline-r2 rows; needs Supabase env in CI secrets)
```

All nodes must PASS. If any node fails, **merge is blocked**.

Además, el job **`e2e`** corre la suite end-to-end contra el entorno de
**staging** (nunca producción) y también bloquea el merge. Los mismos E2E corren
en `pre-commit`. Setup y secretos: **`docs/STAGING.md`**.

Local:

```bash
npm run merge-gate
```

## Admin setup (one-time — needs repo Admin)

Someone with **Admin** on `Nathandavid01/social-dashboard` (usually Nathan) must run:

```bash
# From a machine with gh auth as admin:
bash scripts/apply-branch-protection.sh
```

Or configure in GitHub UI:

**Settings → Branches → Branch protection rule for `main`:**

- Require a pull request before merging  
- Require approvals: **1**  
- Dismiss stale reviews when new commits are pushed  
- Require review from Code Owners (optional once CODEOWNERS is filled)  
- Require status checks to pass:  
  - `merge-gate`  
  - `test`  
  - `e2e` (Playwright contra staging — ver `docs/STAGING.md`)  
  - `relationship-guard` (static job)  
- Require conversation resolution before merging  
- Do not allow bypassing the above settings  
- Restrict who can push to matching branches (empty / admins only)

**Settings → Secrets and variables → Actions** (for live checks):

- `NEXT_PUBLIC_SUPABASE_URL`  
- `SUPABASE_SERVICE_ROLE_KEY`  

Optional for full R2 migration in CI (not required for merge-gate dry-run):

- `R2_*` and `ENTREGAS_R2_*`

## Contributor workflow (Nathan / everyone)

```bash
git checkout -b your-feature
# …work…
npm run merge-gate          # must pass
git push -u origin HEAD
gh pr create --base main
# Wait for CI + review
gh pr merge --squash        # only after green + approval
```

**Never:**

```bash
git push origin main
git commit --no-verify     # do not skip hooks if you add them
```

## Dual-R2 invariant (product)

- Editor deliveries → **`entregas-r2`**  
- Legacy pipeline path → **`r2`** (should stay empty after migration)  
- `/revision` only shows ideas with **edited + entregas-r2** files  

Migration of leftover pipeline objects:

```bash
# after credentials in .env.local:
node --experimental-strip-types scripts/migrate-pipeline-r2-to-entregas.ts --dry-run
node --experimental-strip-types scripts/migrate-pipeline-r2-to-entregas.ts --execute
node --experimental-strip-types scripts/migrate-pipeline-r2-to-entregas.ts --verify
```

## Why this exists

Past incidents (PGRST201 dual FK, wrong bucket for previews) landed without a forced gate. These rules make the same class of mistake fail **before** merge, not in production.
