#!/usr/bin/env bash
# Nate Media — Pipeline autoloop (headless / unattended).
# Ships ONE feature per iteration toward the north star in backlog-pipeline.md,
# verifying twice. Branches off origin/main, opens a PR — never pushes to main.
#
# GUARDRAILS: pre-approves tools (no permission prompts run unattended), caps
# turns, and is bounded. It spends real money and hits PROD Supabase/Vercel.
# Start with ITERS=1 to watch one full cycle before letting it run 5.
set -euo pipefail

cd /Users/ericbotperez/socialdashboard
ITERS="${1:-5}"

PROMPT='Read backlog-pipeline.md FIRST (North Star, Definition of Done, Prod prerequisites, Shipped, Rejected). Do NOT repeat anything in Shipped or Rejected.

ONE unit of work this iteration, toward the North Star (editors/staff generate AI captions + post DIRECTLY to Metricool, verified twice):
1. AUDIT the pipeline for the single most valuable UNBUILT gap on the Definition-of-Done checklist. Brainstorm 3 concrete candidates, score each value×effort, pick the best unbuilt one. If a Prod prerequisite blocks real functionality (e.g. migration 0032 not applied, R2_PUBLIC_BASE_URL/XAI_API_KEY unset), address THAT first: probe prod, and if it is code-fixable do it; if it is config-only, write the exact SQL/steps into backlog-pipeline.md under Prod prerequisites and STOP that item (do not fake-verify it).
2. TDD: write the failing test first (red), then implement (green). Pure logic in lib/**; UI via React Testing Library. Follow CLAUDE.md + the nate-media skill (RBAC: register+gate any new permission; Spanish UI).
3. VERIFY TWICE (hard requirement): run `npx tsc --noEmit` and `npx vitest run --exclude '"'"'**/.claude/**'"'"'` — TWICE, both green (only the known sidebar-context localStorage.clear flake may fail). THEN verify the feature end-to-end by driving the real flow (not just tests): if it does not actually work, change it and re-verify from scratch. Do not proceed until it works twice.
4. Spawn an adversarial review subagent (general-purpose) to hunt HIGH blockers (races, wrong-account/double post, permission gaps, missing revalidate). Fix blockers.
5. Bump lib/version.ts (minor) + add a dated Spanish CHANGELOG.md entry. Open a PR with gh (branch off origin/main; NEVER commit to main). Append to backlog-pipeline.md: move the shipped item to ## Shipped (with PR #) and add 3 freshly-scored ideas to ## Ideas. Include backlog-pipeline.md in the PR.
6. STOP if the Definition of Done is fully ✅ and the last 2 iterations found no real gap (loop complete). Otherwise end the iteration cleanly.'

for i in $(seq 1 "$ITERS"); do
  echo "===== pipeline loop iteration $i / $ITERS ====="
  claude -p "$PROMPT" \
    --allowedTools "Bash Read Edit Write Grep Glob Task" \
    --max-turns 80 \
    || { echo "iteration $i failed (exit $?), continuing"; }
  echo "===== end iteration $i ====="
done
echo "Loop finished. Review open PRs: gh pr list"
