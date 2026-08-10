import { describe, expect, it } from 'vitest'
import {
  assertNoLossCopy,
  buildMigrationPlan,
  isEligiblePipelineR2Row,
  objectBasename,
  planEntregasMigrationKey,
  summarizeMigrationLoss,
  type MigratableVideoRow,
} from './r2-provider-migration'

const sample: MigratableVideoRow = {
  id: '465adcc3-682d-4cc7-8dc7-fbc2ca9b5a1c',
  idea_id: 'fb12908c-7204-486b-b8ae-1d67c8a0a82e',
  kind: 'raw',
  status: 'uploaded',
  name: 'clip.MP4',
  drive_file_id:
    'ideas/fb12908c-7204-486b-b8ae-1d67c8a0a82e/raw/1780046354094-2f5e8d59-fd9a-462b-8934-0fc89f80eb84.mp4',
  storage_provider: 'r2',
  size_bytes: 8647881,
}

const edited: MigratableVideoRow = {
  id: '66b39816-2861-4f87-a02c-2457e56d2b98',
  idea_id: 'fb12908c-7204-486b-b8ae-1d67c8a0a82e',
  kind: 'edited',
  status: 'uploaded',
  name: 'final.mp4',
  drive_file_id:
    'ideas/fb12908c-7204-486b-b8ae-1d67c8a0a82e/edited/1780862825008-grok.mp4',
  storage_provider: 'r2',
  size_bytes: 3991256,
}

describe('planEntregasMigrationKey / eligibility', () => {
  it('maps pipeline keys into entregas/migrated/.../edited|raw/...', () => {
    const key = planEntregasMigrationKey(edited)
    expect(key).toBe(
      'entregas/migrated/fb12908c-7204-486b-b8ae-1d67c8a0a82e/edited/1780862825008-grok.mp4',
    )
    expect(key).toContain('/edited/')
    expect(objectBasename(sample.drive_file_id!)).toMatch(/\.mp4$/i)
  })

  it('only pipeline r2 rows with keys are eligible', () => {
    expect(isEligiblePipelineR2Row(sample)).toBe(true)
    expect(
      isEligiblePipelineR2Row({ ...sample, storage_provider: 'entregas-r2' }),
    ).toBe(false)
    expect(isEligiblePipelineR2Row({ ...sample, drive_file_id: null })).toBe(false)
  })
})

describe('buildMigrationPlan', () => {
  it('plans both known production pipeline-r2 rows and skips already-migrated', () => {
    const { plan, skipped } = buildMigrationPlan([
      sample,
      edited,
      { ...edited, id: 'already', storage_provider: 'entregas-r2' },
    ])
    expect(plan).toHaveLength(2)
    expect(plan.map((p) => p.videoId).sort()).toEqual(
      [sample.id, edited.id].sort(),
    )
    expect(plan.every((p) => p.destKey.startsWith('entregas/migrated/'))).toBe(true)
    expect(skipped.some((s) => s.reason === 'already_entregas_r2')).toBe(true)
  })
})

describe('assertNoLossCopy / summarizeMigrationLoss', () => {
  it('rejects size mismatches (no silent truncation)', () => {
    const bad = assertNoLossCopy({ sourceSize: 100, destSize: 99 })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toMatch(/size_mismatch/)
    expect(assertNoLossCopy({ sourceSize: 100, destSize: 100, expectedSizeBytes: 100 })).toEqual({
      ok: true,
    })
  })

  it('zero-loss only when every planned id succeeded and no leftover pipeline rows', () => {
    const planIds = [sample.id, edited.id]
    expect(
      summarizeMigrationLoss({
        planIds,
        succeededIds: [sample.id, edited.id],
        remainingPipelineR2Ids: [],
      }).ok,
    ).toBe(true)
    expect(
      summarizeMigrationLoss({
        planIds,
        succeededIds: [sample.id],
        remainingPipelineR2Ids: [edited.id],
      }),
    ).toEqual({
      ok: false,
      missing: [edited.id],
      leftover: [edited.id],
    })
  })
})

describe('mjs twin stays aligned with TS module', () => {
  it('buildMigrationPlan from .mjs matches .ts for production sample rows', async () => {
    const mjs = await import('./r2-provider-migration.mjs')
    const rows = [
      {
        id: '465adcc3-682d-4cc7-8dc7-fbc2ca9b5a1c',
        idea_id: 'fb12908c-7204-486b-b8ae-1d67c8a0a82e',
        kind: 'raw',
        status: 'uploaded',
        name: 'clip.MP4',
        drive_file_id:
          'ideas/fb12908c-7204-486b-b8ae-1d67c8a0a82e/raw/1780046354094-2f5e8d59-fd9a-462b-8934-0fc89f80eb84.mp4',
        storage_provider: 'r2',
        size_bytes: 8647881,
      },
    ]
    const a = buildMigrationPlan(rows as never)
    const b = mjs.buildMigrationPlan(rows)
    expect(b.plan).toEqual(a.plan)
    expect(b.skipped).toEqual(a.skipped)
  })
})
