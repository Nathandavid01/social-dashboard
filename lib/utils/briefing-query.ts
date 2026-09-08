/** A missing or truncated response is unknown, never an empty workload. */
export function briefingQueryIssue(
  response: {data: unknown[] | null; count: number | null; error: unknown},
  label: string,
  countOnly = false,
): string | null {
  if (response.error) return `${label}: no se pudo consultar.`
  if (response.count === null || !Number.isFinite(response.count)) return `${label}: conteo sin verificar.`
  if (!countOnly && (!response.data || response.data.length !== response.count)) return `${label}: consulta incompleta.`
  return null
}
