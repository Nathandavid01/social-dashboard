# Loop — un cambio por hora, PR verificado en staging

Cada hora toma **el primer ítem `[ ]`**. Al cerrar el commit, márcalo `[x]` y deja en el cuerpo del PR la línea **Siguiente:** con el ítem que sigue. El PR siguiente se abre **encima** de este (misma rama o `main` si ya mergeó).

**Reglas**
- Un solo cambio observable. TDD. Changelog en español (captura si hay UI).
- Verificar: `npx vitest run` de los tests tocados + `npm run test:staging` si el cambio toca sesión/auth; si no, al menos merge-gate.
- No push a `main`. PR → CI verde.
- Tema: **flujo más lógico** o **captions automáticos**. Nada de rediseños laterales.

## Cadena

- [x] **Paso 0** — Asignaciones por empleado + color + quién cambió (`eric/asignaciones-por-empleado`).
- [x] **Paso 1** — Contrato `captionJobsForPlatforms` + prompt puede apuntar a **una** red (`targetPlatform`). `shouldAutoDraftCaption` decide cuándo un video está listo para borrador solo. Nadie genera todavía en background.
- [ ] **Paso 2** — Si `shouldAutoDraftCaption`, al abrir la idea / Entregas se llama `generateIdeaCaption` una vez (no pisa un draft existente).
- [ ] **Paso 3** — `generateIdeaCaption` recorre `captionJobsForPlatforms` y produce un draft por red (aún en un solo campo o JSON en `caption_draft` si 0030 no está).
- [ ] **Paso 4** — Aplicar `0030_content_idea_captions.sql` en staging y persistir una fila por red.
- [ ] **Paso 5** — UI: un caption editable por red en Copy / idea.
- [ ] **Paso 6** — Aplicar `0041_caption_feedback.sql` en staging; 👍/👎 por caption alimenta el prompt del paso 3.
- [ ] **Paso 7** — Auto-publish al aprobar (depende de `0032` en staging): solo si hay caption aprobado + video editado + Metricool.

## Cómo corre el agente

1. `cd "/Users/ericperez/Nate Media/social-dashboard"`
2. `git fetch origin && git checkout` la rama del PR abierto (`eric/asignaciones-por-empleado` / `eric/daily-loop`); si ya mergeó, `git checkout -B eric/daily-loop origin/main`.
3. Leer este archivo. Implementar el primer `[ ]`.
4. Tests + changelog vX.Y.
5. `git push` + `gh pr create` mencionando el PR anterior.
6. Marcar el ítem `[x]` en este archivo en el mismo commit.
