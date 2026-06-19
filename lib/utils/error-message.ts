// Maps raw server/DB/Supabase error strings to friendly Spanish copy so the UI
// never shows users a SQL constraint name, a stack trace, or an opaque
// PostgREST code. Use this at every `toast({ description })` that surfaces a
// server `result.error`.

const GENERIC = 'Algo salió mal. Vuelve a intentarlo.'

// Ordered patterns → friendly message. First match wins.
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/failed to fetch|fetch failed|network ?error|err_network/i,
    'Problema de conexión. Revisa tu internet e inténtalo otra vez.'],
  [/row-level security|permission denied|not authorized|no autorizado|forbidden/i,
    'No tienes permiso para realizar esta acción.'],
  [/not-null constraint|violates not.?null|null value in column/i,
    'Falta un campo obligatorio.'],
  [/unique constraint|duplicate key/i,
    'Ya existe un registro con esos datos.'],
  [/foreign key constraint/i,
    'No se puede completar: hay datos relacionados.'],
  [/check constraint/i,
    'Alguno de los datos no es válido.'],
]

// Markers that mean "this is raw machine noise, not a human-readable message".
const RAW_NOISE =
  /\bselect\b|\binsert\b|\bupdate\b.+\bset\b|sqlstate|postgrest|pg_|\bat [\w.$<>]+ \(|:\d+:\d+\)|42\d{3}|22\d{3}|23\d{3}/i

export function friendlyError(input: unknown): string {
  const raw = (input instanceof Error ? input.message : String(input ?? '')).trim()
  if (!raw) return GENERIC

  for (const [pattern, message] of RULES) {
    if (pattern.test(raw)) return message
  }

  // If it still looks like raw machine output, don't leak it to the user.
  if (RAW_NOISE.test(raw)) return GENERIC

  // A short, clean sentence is almost certainly an intentional human message
  // from a server action (e.g. "El nombre es obligatorio"). Pass it through.
  if (raw.length <= 160 && !raw.includes('\n')) return raw

  return GENERIC
}
