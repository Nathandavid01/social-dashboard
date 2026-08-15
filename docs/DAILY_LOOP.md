# Loop — un cambio por hora, PR verificado en staging

Cada hora toma **el primer ítem `[ ]`**. Al cerrar el commit, márcalo `[x]` y deja en el cuerpo del PR la línea **Siguiente:** con el ítem que sigue. El PR siguiente se abre **encima** de este (misma rama o `main` si ya mergeó).

**Reglas**
- Un solo cambio observable. TDD. Changelog en español (captura si hay UI).
- **Caption solo si hay video** (no generar/guardar copy de una idea sin footage).
- **Caption grounded in the video** when we can hear it (Whisper, v3.22). Vision frames = later.
- **Un solo caption para todas las redes** (v3.25). No fan-out por plataforma.
- **Metricool publica el corte de Entregas / el archivo que se revisó**, no un edited viejo del pipeline (v3.28).
- Verificar: `npx vitest run` de los tests tocados + `npm run test:staging` si el cambio toca sesión/auth; si no, al menos merge-gate.
- No push a `main`. PR → CI verde.
- Tema: **flujo más lógico** o **captions automáticos**. Nada de rediseños laterales.

## Cadena

- [x] **Paso 0** — Asignaciones por empleado + color + quién cambió (`eric/asignaciones-por-empleado`).
- [x] **Paso 1** — Contrato `captionJobsForPlatforms` + prompt puede apuntar a **una** red (`targetPlatform`). `shouldAutoDraftCaption` decide cuándo un video está listo para borrador solo. Nadie genera todavía en background.
- [x] **Paso 2** — Si `shouldAutoDraftCaption`, al abrir la idea / Entregas se llama `generateIdeaCaption` una vez (no pisa un draft existente).
- [x] **Paso 3** — Revertido en v3.25: el equipo quiere **un** caption para todas las redes, no uno por red.
- [x] **Paso 4** — Cancelado (persistir una fila por red). Ya no aplica.
- [x] **Paso 5** — Cancelado (UI por red). Ya no aplica.
- [x] **Paso 6** — Aplicar `0041_caption_feedback.sql` en staging; 👍/👎 del caption único alimenta el próximo generate.
- [x] **Paso 7** — Auto-publish al aprobar (depende de `0032` en staging): solo si hay caption aprobado + video editado + Metricool.

## Cómo corre el agente

1. `cd "/Users/ericperez/Nate Media/social-dashboard"`
2. `git fetch origin && git checkout` la rama del PR abierto (`eric/asignaciones-por-empleado` / `eric/daily-loop`); si ya mergeó, `git checkout -B eric/daily-loop origin/main`.
3. Leer este archivo. Implementar el primer `[ ]`.
4. Tests + changelog vX.Y.
5. `git push` + `gh pr create` mencionando el PR anterior.
6. Marcar el ítem `[x]` en este archivo en el mismo commit.
