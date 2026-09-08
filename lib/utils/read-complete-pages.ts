/** Read a stably ordered query, rejecting partial/changed results instead of hiding rows. */
export async function readCompletePages<T extends { id: string }>(
  read: (from: number, to: number) => PromiseLike<{data: T[] | null; count: number | null; error?: unknown}>,
): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  let expected: number | null = null
  for (;;) {
    const result = await read(rows.length, rows.length + 499)
    if (result.error || !result.data || result.count == null || (expected !== null && expected !== result.count)) {
      throw new Error('No se pudo verificar la consulta completa.')
    }
    expected = result.count
    for (const row of result.data) {
      if (seen.has(row.id)) throw new Error('Los datos cambiaron durante la consulta.')
      seen.add(row.id)
    }
    rows.push(...result.data)
    if (rows.length === expected) return rows
    if (!result.data.length || rows.length > expected || rows.length >= 100000) throw new Error('La consulta está incompleta.')
  }
}
