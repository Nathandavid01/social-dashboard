/**
 * Live RLS + insert checks against natemedia-staging.
 * Skipped unless STAGING_TEST=1 (so `npm test` never touches staging).
 *
 *   STAGING_TEST=1 npm run test:staging
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertStagingUrl, parseDotEnv } from '@/lib/utils/staging-env'

function loadStagingEnv() {
  const path = resolve(process.cwd(), '.env.staging')
  if (!existsSync(path)) {
    throw new Error('Falta .env.staging — estas pruebas no corren sin el proyecto de staging.')
  }
  const parsed = parseDotEnv(readFileSync(path, 'utf8'))
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v
  }
}

const enabled = process.env.STAGING_TEST === '1'
const describeStaging = enabled ? describe : describe.skip

describeStaging('ui_events on natemedia-staging', () => {
  let owner: SupabaseClient
  let supervisor: SupabaseClient
  let ownerId: string
  let marker: string

  it('loads staging env and refuses to run against production', () => {
    loadStagingEnv()
    assertStagingUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy()
  })

  it('lets the owner insert and read their own breadcrumb', async () => {
    loadStagingEnv()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const email = process.env.STAGING_OWNER_EMAIL ?? 'eric.perez.pr@gmail.com'
    const password = process.env.STAGING_OWNER_PASSWORD
    if (!password) throw new Error('Falta STAGING_OWNER_PASSWORD en .env.staging')

    owner = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await owner.auth.signInWithPassword({ email, password })
    expect(error, error?.message).toBeNull()
    ownerId = (await owner.auth.getUser()).data.user?.id ?? ''
    expect(ownerId).toBeTruthy()

    marker = `stg-${Date.now()}`
    const { error: insErr } = await owner.from('ui_events').insert({
      user_id: ownerId,
      kind: 'click',
      path: '/home',
      label: marker,
      target: 'button',
    })
    expect(insErr, insErr?.message).toBeNull()

    const { data, error: readErr } = await owner
      .from('ui_events')
      .select('id, label, user_id')
      .eq('label', marker)
    expect(readErr, readErr?.message).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.user_id).toBe(ownerId)
  })

  it('lets a supervisor insert but never read, and blocks spoofing the owner', async () => {
    loadStagingEnv()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD
    if (!email || !password) throw new Error('Falta E2E_USER_EMAIL / E2E_USER_PASSWORD en .env.staging')

    supervisor = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await supervisor.auth.signInWithPassword({ email, password })
    expect(error, error?.message).toBeNull()
    const supId = (await supervisor.auth.getUser()).data.user?.id ?? ''

    const { error: insErr } = await supervisor.from('ui_events').insert({
      user_id: supId,
      kind: 'navigate',
      path: '/home',
      label: '/home',
      target: null,
    })
    expect(insErr, insErr?.message).toBeNull()

    const { data, error: readErr } = await supervisor.from('ui_events').select('id')
    expect(readErr).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { error: spoof } = await supervisor.from('ui_events').insert({
      user_id: ownerId,
      kind: 'click',
      path: '/home',
      label: 'spoof',
      target: 'button',
    })
    expect(spoof).toBeTruthy()
  })

  afterAll(async () => {
    await owner?.auth.signOut()
    await supervisor?.auth.signOut()
  })
})
