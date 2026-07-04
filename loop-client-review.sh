#!/usr/bin/env bash
# Autoloop headless — Portal de Aprobación del Cliente (Nate Media).
# Construye SOLO ideas value 10/10, un incremento por iteración, TDD (test primero).
# Guardrails: rama dedicada (nunca main), tools pre-aprobados, max-turns, tope de iteraciones.
#
# Uso:   ./loop-client-review.sh
# Requiere: gh autenticado, .env.local con creds, node_modules instalado.
set -euo pipefail

REPO="/Users/ericbotperez/socialdashboard/.claude/worktrees/eric-client-review-portal"
STATE="backlog-client-review.md"
ITERATIONS="${1:-4}"      # 4 incrementos por defecto
MAX_TURNS=80

cd "$REPO"

for i in $(seq 1 "$ITERATIONS"); do
  echo "════════ Iteración $i/$ITERATIONS ════════"
  claude -p "$(cat <<'PROMPT'
Estás en el worktree del Portal de Aprobación del Cliente de Nate Media (Next.js 14 + Supabase + R2).

1. LEE `backlog-client-review.md` PRIMERO. Mira `## Definition of Done` (el orden Inc 1→4),
   `## Shipped` (no repetir) y `## Decisiones de producto` (no re-preguntar — ya están fijadas).
2. Toma el PRIMER incremento NO shippeado del DoD. Trabaja SOLO ese (un incremento por iteración).
   Regla dura: solo se construyen ideas value 10/10. Si el siguiente item no es 10, para y anótalo en `## Ideas`.
3. TDD ESTRICTO: escribe el/los test PRIMERO, corre `npx vitest run <archivo>` y CONFIRMA que falla,
   LUEGO implementa hasta que pase. Lógica pura → `lib/utils/*-core.ts`; UI → React Testing Library.
4. Gate verde OBLIGATORIO antes de cerrar: `npx tsc --noEmit` (0 errores) + `npx vitest run`
   (verde = solo el flake conocido `sidebar-context.test.tsx`). Si un archivo falla raro bajo carga,
   re-córrelo aislado.
5. Ship: `git add -A && git commit` (mensaje claro en inglés), `git push -u origin HEAD`,
   abre PR con `gh pr create`. Lanza un sub-agente de review ADVERSARIAL (busca: escritura sin
   validar token, exposición del service-role al cliente, fuga de RLS, doble-publish, revalidate
   faltante). Resuelve HIGH blockers. Luego `gh pr merge --squash`.
6. Bump `lib/version.ts` (APP_VERSION, minor por incremento) + sección `## vX.Y` fechada en
   `CHANGELOG.md` (español, qué cambió para el usuario).
7. Verifica el deploy de Vercel READY del merge commit:
   `gh api repos/Nathandavid01/social-dashboard/commits/<sha>/status`.
8. ACTUALIZA `backlog-client-review.md`: marca el incremento `[x]` en el DoD y añade una línea a `## Shipped`.

CONDICIÓN DE TÉRMINO: si todos los incrementos del DoD están `[x]` y el e2e real está verificado,
NO hagas más — imprime "LOOP COMPLETO" y termina.
PROMPT
)" \
    --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Agent" \
    --max-turns "$MAX_TURNS"

  if grep -q "LOOP COMPLETO" <<<"$(tail -c 2000 /dev/null 2>/dev/null || true)"; then
    echo "Loop completo — saliendo."
    break
  fi
  echo "─── fin iteración $i ───"
  sleep 3
done
