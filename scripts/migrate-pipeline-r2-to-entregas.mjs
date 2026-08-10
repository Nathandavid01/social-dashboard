#!/usr/bin/env node
/**
 * Copy content_idea_videos from pipeline R2 → Entregas R2, then retarget DB.
 * Refuses DB update unless object sizes match.
 *
 *   node scripts/migrate-pipeline-r2-to-entregas.mjs --dry-run
 *   node scripts/migrate-pipeline-r2-to-entregas.mjs --execute
 *   node scripts/migrate-pipeline-r2-to-entregas.mjs --verify
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  buildMigrationPlan,
  assertNoLossCopy,
  summarizeMigrationLoss,
  PIPELINE_PROVIDER,
  ENTREGAS_PROVIDER,
} from '../lib/utils/r2-provider-migration.mjs'

function loadEnvLocal() {
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i)
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) process.env[k] = v
  }
}

/** @param {'pipeline' | 'entregas'} kind */
function makeClient(kind) {
  const isEntregas = kind === 'entregas'
  const accountId = process.env[isEntregas ? 'ENTREGAS_R2_ACCOUNT_ID' : 'R2_ACCOUNT_ID']
  const accessKeyId = process.env[isEntregas ? 'ENTREGAS_R2_ACCESS_KEY_ID' : 'R2_ACCESS_KEY_ID']
  const secretAccessKey = process.env[isEntregas ? 'ENTREGAS_R2_SECRET_ACCESS_KEY' : 'R2_SECRET_ACCESS_KEY']
  const bucket =
    process.env[isEntregas ? 'ENTREGAS_R2_BUCKET' : 'R2_BUCKET'] || (isEntregas ? '' : 'nmedia-videos')
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { client: null, bucket: null, missing: true }
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return { client, bucket, missing: false }
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks = []
  for await (const chunk of body) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function fetchPipelineR2Rows(url, key) {
  const res = await fetch(
    `${url}/rest/v1/content_idea_videos?select=id,idea_id,kind,status,name,drive_file_id,storage_provider,size_bytes&storage_provider=eq.r2&order=uploaded_at.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) throw new Error(`Supabase list failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function countProvider(url, key, provider) {
  const res = await fetch(`${url}/rest/v1/content_idea_videos?select=id&storage_provider=eq.${provider}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  const cr = res.headers.get('content-range') || ''
  const m = /\/(\d+|\*)/.exec(cr)
  if (m && m[1] !== '*') return Number(m[1])
  const rows = await res.json()
  return Array.isArray(rows) ? rows.length : 0
}

async function patchRow(url, key, videoId, destKey) {
  const res = await fetch(`${url}/rest/v1/content_idea_videos?id=eq.${videoId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      storage_provider: ENTREGAS_PROVIDER,
      drive_file_id: destKey,
      notes: 'migrated-from-pipeline-r2',
    }),
  })
  if (!res.ok) throw new Error(`DB update ${videoId}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  loadEnvLocal()
  const args = new Set(process.argv.slice(2))
  const execute = args.has('--execute')
  const verifyOnly = args.has('--verify')
  const dryRun = !execute && !verifyOnly

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) {
    if (dryRun) {
      console.log(
        JSON.stringify({
          mode: 'dry-run',
          skipped: true,
          reason: 'no_supabase_env',
          note: 'CI without secrets is OK for dry-run; set Actions secrets for live inventory.',
        }),
      )
      process.exitCode = 0
      return
    }
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exitCode = 2
    return
  }

  const rows = await fetchPipelineR2Rows(url, serviceKey)
  const { plan, skipped } = buildMigrationPlan(rows)
  console.log(
    JSON.stringify(
      {
        mode: execute ? 'execute' : verifyOnly ? 'verify' : 'dry-run',
        pipeline_r2_rows: rows.length,
        plan: plan.length,
        skipped,
      },
      null,
      2,
    ),
  )
  for (const p of plan) {
    console.log(`- ${p.videoId} ${p.sourceKey} -> ${p.destKey} (size_bytes=${p.expectedSizeBytes})`)
  }

  if (verifyOnly) {
    const leftover = await fetchPipelineR2Rows(url, serviceKey)
    const ok = leftover.length === 0
    console.log(
      JSON.stringify(
        {
          verify: ok ? 'PASS' : 'FAIL',
          remaining_pipeline_r2: leftover.length,
          leftover_ids: leftover.map((r) => r.id),
        },
        null,
        2,
      ),
    )
    process.exitCode = ok ? 0 : 1
    return
  }

  if (dryRun) {
    console.log('Dry-run only. Re-run with --execute after R2_* and ENTREGAS_R2_* are set.')
    const src = makeClient('pipeline')
    const dst = makeClient('entregas')
    console.log(
      JSON.stringify(
        {
          pipeline_r2_credentials: src.missing ? 'ABSENT' : 'PRESENT',
          entregas_r2_credentials: dst.missing ? 'ABSENT' : 'PRESENT',
        },
        null,
        2,
      ),
    )
    process.exitCode = 0
    return
  }

  const src = makeClient('pipeline')
  const dst = makeClient('entregas')
  if (src.missing || dst.missing || !src.client || !dst.client || !src.bucket || !dst.bucket) {
    console.error('Cannot execute: pipeline R2 and/or Entregas R2 credentials missing.')
    process.exitCode = 2
    return
  }

  const succeeded = []
  const failed = []
  for (const item of plan) {
    try {
      const headSrc = await src.client.send(
        new HeadObjectCommand({ Bucket: src.bucket, Key: item.sourceKey }),
      )
      const sourceSize = headSrc.ContentLength ?? null
      const get = await src.client.send(
        new GetObjectCommand({ Bucket: src.bucket, Key: item.sourceKey }),
      )
      const buf = await streamToBuffer(get.Body)
      if (sourceSize != null && buf.length !== sourceSize) {
        throw new Error(`download size mismatch ${buf.length} vs head ${sourceSize}`)
      }
      await dst.client.send(
        new PutObjectCommand({
          Bucket: dst.bucket,
          Key: item.destKey,
          Body: buf,
          ContentType: get.ContentType || 'video/mp4',
        }),
      )
      const headDst = await dst.client.send(
        new HeadObjectCommand({ Bucket: dst.bucket, Key: item.destKey }),
      )
      const destSize = headDst.ContentLength ?? buf.length
      const check = assertNoLossCopy({
        sourceSize: sourceSize ?? buf.length,
        destSize,
        expectedSizeBytes: item.expectedSizeBytes,
      })
      if (!check.ok) throw new Error(check.reason)
      await patchRow(url, serviceKey, item.videoId, item.destKey)
      succeeded.push(item.videoId)
      console.log(`OK ${item.videoId} bytes=${destSize}`)
    } catch (err) {
      failed.push({ videoId: item.videoId, error: err instanceof Error ? err.message : String(err) })
      console.error(`FAIL ${item.videoId}:`, err instanceof Error ? err.message : err)
    }
  }

  const remaining = await fetchPipelineR2Rows(url, serviceKey)
  const loss = summarizeMigrationLoss({
    planIds: plan.map((p) => p.videoId),
    succeededIds: succeeded,
    remainingPipelineR2Ids: remaining.map((r) => r.id),
  })
  const report = {
    succeeded: succeeded.length,
    failed,
    remaining_pipeline_r2: remaining.length,
    zero_loss: loss.ok,
    missing: loss.missing,
    leftover: loss.leftover,
    entregas_count: await countProvider(url, serviceKey, ENTREGAS_PROVIDER),
    pipeline_count: await countProvider(url, serviceKey, PIPELINE_PROVIDER),
  }
  console.log(JSON.stringify(report, null, 2))
  writeFileSync(resolve(process.cwd(), 'migration-r2-report.json'), JSON.stringify(report, null, 2))
  process.exitCode = loss.ok && failed.length === 0 ? 0 : 1
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : null
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
