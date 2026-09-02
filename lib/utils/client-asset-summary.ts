export interface ClientAssetSummaryRow {
  client_id: string
  kind: string
  name: string
  url: string
  storage_path: string | null
}

export interface ClientAssetSummary {
  logos: number
  /** Primer activo-enlace (sin archivo) cuyo nombre mencione b-roll. */
  brollFolderUrl: string | null
}

/** Por cliente: logos subidos y carpeta externa de B-rolls, para los enlaces del banco. */
export function summarizeClientAssets(rows: ClientAssetSummaryRow[]): Record<string, ClientAssetSummary> {
  const out: Record<string, ClientAssetSummary> = {}
  for (const r of rows) {
    const s = (out[r.client_id] ??= { logos: 0, brollFolderUrl: null })
    if (r.kind === 'logo') s.logos++
    if (!r.storage_path && /b-?roll/i.test(r.name) && !s.brollFolderUrl) s.brollFolderUrl = r.url
  }
  return out
}
