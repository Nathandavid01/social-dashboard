/**
 * Plan + verify migration of content_idea_videos from pipeline R2 (`r2`)
 * to Entregas R2 (`entregas-r2`) without silent data loss.
 *
 * Pure helpers — the CLI script does I/O (S3 + Supabase).
 */

export const PIPELINE_PROVIDER = 'r2' as const
export const ENTREGAS_PROVIDER = 'entregas-r2' as const

export type MigratableVideoRow = {
  id: string
  idea_id: string
  kind: string
  status: string
  name: string | null
  drive_file_id: string | null
  storage_provider: string
  size_bytes: number | null
}

export type MigrationPlanItem = {
  videoId: string
  ideaId: string
  kind: string
  sourceKey: string
  destKey: string
  expectedSizeBytes: number | null
  name: string | null
}

export type CopyResult = {
  videoId: string
  ok: boolean
  sourceSize?: number
  destSize?: number
  error?: string
  destKey?: string
}

/** Basename of an R2 object key. */
export function objectBasename(key: string): string {
  const parts = key.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || key
}

/**
 * Destination key on Entregas bucket. Keeps idea/kind structure and embeds
 * `/edited/` or `/raw/` so any path-based public workers still match.
 */
export function planEntregasMigrationKey(row: {
  idea_id: string
  kind: string
  drive_file_id: string | null
  name?: string | null
}): string {
  const base =
    objectBasename(row.drive_file_id || '') ||
    (row.name || 'video.bin').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  return `entregas/migrated/${row.idea_id}/${row.kind}/${base}`
}

/** Only pipeline-r2 rows with a real object key are eligible. */
export function isEligiblePipelineR2Row(row: MigratableVideoRow): boolean {
  return (
    row.storage_provider === PIPELINE_PROVIDER &&
    typeof row.drive_file_id === 'string' &&
    row.drive_file_id.trim().length > 0 &&
    row.status !== 'failed'
  )
}

export function buildMigrationPlan(rows: MigratableVideoRow[]): {
  plan: MigrationPlanItem[]
  skipped: { videoId: string; reason: string }[]
} {
  const plan: MigrationPlanItem[] = []
  const skipped: { videoId: string; reason: string }[] = []
  for (const row of rows) {
    if (row.storage_provider === ENTREGAS_PROVIDER) {
      skipped.push({ videoId: row.id, reason: 'already_entregas_r2' })
      continue
    }
    if (!isEligiblePipelineR2Row(row)) {
      skipped.push({
        videoId: row.id,
        reason: !row.drive_file_id?.trim() ? 'missing_object_key' : `ineligible_provider_or_status:${row.storage_provider}/${row.status}`,
      })
      continue
    }
    plan.push({
      videoId: row.id,
      ideaId: row.idea_id,
      kind: row.kind,
      sourceKey: row.drive_file_id!.trim(),
      destKey: planEntregasMigrationKey(row),
      expectedSizeBytes: row.size_bytes,
      name: row.name,
    })
  }
  return { plan, skipped }
}

/**
 * After copy: require dest size to match source (and optional DB size_bytes).
 * Prevents marking a row migrated when the object was truncated/missing.
 */
export function assertNoLossCopy(args: {
  sourceSize: number | null | undefined
  destSize: number | null | undefined
  expectedSizeBytes?: number | null
}): { ok: true } | { ok: false; reason: string } {
  const { sourceSize, destSize, expectedSizeBytes } = args
  if (sourceSize == null || sourceSize < 0) {
    return { ok: false, reason: 'source_size_unknown' }
  }
  if (destSize == null || destSize < 0) {
    return { ok: false, reason: 'dest_size_unknown' }
  }
  if (sourceSize !== destSize) {
    return { ok: false, reason: `size_mismatch source=${sourceSize} dest=${destSize}` }
  }
  if (expectedSizeBytes != null && expectedSizeBytes > 0 && destSize !== expectedSizeBytes) {
    return {
      ok: false,
      reason: `db_size_mismatch db=${expectedSizeBytes} dest=${destSize}`,
    }
  }
  return { ok: true }
}

/**
 * Zero-loss inventory: every originally planned pipeline-r2 id must appear in
 * successful copies; remaining pipeline-r2 rows after migration must be empty
 * (or only explicitly skipped non-eligible).
 */
export function summarizeMigrationLoss(args: {
  planIds: string[]
  succeededIds: string[]
  remainingPipelineR2Ids: string[]
}): { ok: boolean; missing: string[]; leftover: string[] } {
  const okSet = new Set(args.succeededIds)
  const missing = args.planIds.filter((id) => !okSet.has(id))
  const leftover = args.remainingPipelineR2Ids
  return {
    ok: missing.length === 0 && leftover.length === 0,
    missing,
    leftover,
  }
}
