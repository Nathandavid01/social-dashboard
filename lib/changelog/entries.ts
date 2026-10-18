/**
 * Entradas del CHANGELOG.md para el aviso de «Novedades».
 *
 * Puro (sin fs): el route handler lee el archivo y el cliente solo recibe las
 * entradas que le tocan. Cada entrada es un bloque `## vX.Y[ — fecha]` con un
 * titular en negrita y el resto en markdown (viñetas, enlace al diseño, captura).
 */
export type ChangelogEntry = {
  version: string
  date: string | null
  headline: string | null
  body: string
}

const VERSION_RE = /^\d+(\.\d+)*$/
const HEADING_RE = /^## v(\d+(?:\.\d+)*)(?:\s+—\s+(\S+))?\s*$/

/** >0 si a es más nueva que b. Numérico por parte: 5.139 > 5.14, 3.93.1 > 3.93. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function parseChangelog(md: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: { version: string; date: string | null; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const lines = current.lines
    const idx = lines.findIndex((l) => /^\*\*.+\*\*$/.test(l.trim()))
    const headline = idx === -1 ? null : lines[idx].trim().slice(2, -2)
    const rest = idx === -1 ? lines : [...lines.slice(0, idx), ...lines.slice(idx + 1)]
    entries.push({
      version: current.version,
      date: current.date,
      headline,
      body: rest.join('\n').trim(),
    })
  }

  for (const line of md.split('\n')) {
    const m = HEADING_RE.exec(line)
    if (m) {
      flush()
      current = { version: m[1], date: m[2] ?? null, lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()
  return entries
}

/**
 * Lo que toca enseñar: lo publicado después de `lastSeen` y hasta `current`
 * (la versión del bundle), de la más nueva a la más vieja. Quien nunca vio
 * nada (o tiene basura guardada) ve solo la novedad más reciente.
 */
export function entriesToShow(
  entries: ChangelogEntry[],
  { lastSeen, current, max = 6 }: { lastSeen: string | null; current: string; max?: number },
): ChangelogEntry[] {
  const released = entries
    .filter((e) => compareVersions(e.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
  if (!lastSeen || !VERSION_RE.test(lastSeen)) return released.slice(0, 1)
  return released.filter((e) => compareVersions(e.version, lastSeen) > 0).slice(0, max)
}
