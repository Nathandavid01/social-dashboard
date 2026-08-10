/** ESM twin of r2-provider-migration.ts for Node 20 CLI (keep in sync with .ts). */

export const PIPELINE_PROVIDER = 'r2'
export const ENTREGAS_PROVIDER = 'entregas-r2'

export function objectBasename(key) {
  const parts = key.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || key
}

export function planEntregasMigrationKey(row) {
  const base =
    objectBasename(row.drive_file_id || '') ||
    (row.name || 'video.bin').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  return `entregas/migrated/${row.idea_id}/${row.kind}/${base}`
}

export function isEligiblePipelineR2Row(row) {
  return (
    row.storage_provider === PIPELINE_PROVIDER &&
    typeof row.drive_file_id === 'string' &&
    row.drive_file_id.trim().length > 0 &&
    row.status !== 'failed'
  )
}

export function buildMigrationPlan(rows) {
  const plan = []
  const skipped = []
  for (const row of rows) {
    if (row.storage_provider === ENTREGAS_PROVIDER) {
      skipped.push({ videoId: row.id, reason: 'already_entregas_r2' })
      continue
    }
    if (!isEligiblePipelineR2Row(row)) {
      skipped.push({
        videoId: row.id,
        reason: !row.drive_file_id?.trim()
          ? 'missing_object_key'
          : `ineligible_provider_or_status:${row.storage_provider}/${row.status}`,
      })
      continue
    }
    plan.push({
      videoId: row.id,
      ideaId: row.idea_id,
      kind: row.kind,
      sourceKey: row.drive_file_id.trim(),
      destKey: planEntregasMigrationKey(row),
      expectedSizeBytes: row.size_bytes,
      name: row.name,
    })
  }
  return { plan, skipped }
}

export function assertNoLossCopy({ sourceSize, destSize, expectedSizeBytes }) {
  if (sourceSize == null || sourceSize < 0) return { ok: false, reason: 'source_size_unknown' }
  if (destSize == null || destSize < 0) return { ok: false, reason: 'dest_size_unknown' }
  if (sourceSize !== destSize) {
    return { ok: false, reason: `size_mismatch source=${sourceSize} dest=${destSize}` }
  }
  if (expectedSizeBytes != null && expectedSizeBytes > 0 && destSize !== expectedSizeBytes) {
    return { ok: false, reason: `db_size_mismatch db=${expectedSizeBytes} dest=${destSize}` }
  }
  return { ok: true }
}

export function summarizeMigrationLoss({ planIds, succeededIds, remainingPipelineR2Ids }) {
  const okSet = new Set(succeededIds)
  const missing = planIds.filter((id) => !okSet.has(id))
  const leftover = remainingPipelineR2Ids
  return { ok: missing.length === 0 && leftover.length === 0, missing, leftover }
}
