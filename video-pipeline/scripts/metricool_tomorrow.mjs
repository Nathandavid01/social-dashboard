#!/usr/bin/env node
/** Read-only: clients posting tomorrow + last 10 published Metricool posts. Never prints secrets. */
import { resolveDashboard } from '../dashboard_paths.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
function option(name) { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
const requestedClient = option('--client')
const historyOnly = args.includes('--history-only')
const requestedOut = option('--out')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dash = resolveDashboard(root)
for (const line of readFileSync(resolve(dash, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const token = process.env.METRICOOL_TOKEN
const userId = process.env.METRICOOL_USER_ID
if (!supabaseUrl || !supabaseKey || !token || !userId) {
  throw new Error('Falta Supabase o Metricool en el .env.local del dashboard')
}

const TZ = 'America/Puerto_Rico'
const now = new Date()
const tomorrowLocal = new Date(now.toLocaleString('en-US', { timeZone: TZ }))
tomorrowLocal.setDate(tomorrowLocal.getDate() + 1)
const y = tomorrowLocal.getFullYear()
const mo = String(tomorrowLocal.getMonth() + 1).padStart(2, '0')
const da = String(tomorrowLocal.getDate()).padStart(2, '0')
const dayIso = `${y}-${mo}-${da}`
const weekday = tomorrowLocal.getDay() // 0=Sun
const labels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

async function rest(table, query) {
  const url = `${supabaseUrl}/rest/v1/${table}?${new URLSearchParams(query)}`
  const res = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  if (!res.ok) throw new Error(`${table} HTTP ${res.status}`)
  return res.json()
}

async function metricool(path, params) {
  const url = new URL(`https://app.metricool.com/api${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
  const text = await res.text()
  if (!res.ok) return { error: `${res.status}`, body: text.slice(0, 200) }
  try { return JSON.parse(text) } catch { return { error: 'json', body: text.slice(0, 200) } }
}

function unwrap(json) {
  if (Array.isArray(json)) return json
  if (json && Array.isArray(json.data)) return json.data
  return []
}

function mediaUrls(post) {
  const urls = []
  const push = (u) => { if (typeof u === 'string' && /^https?:/.test(u)) urls.push(u) }
  push(post.mediaUrl)
  push(post.imageUrl)
  push(post.picture)
  push(post.videoUrl)
  const media = post.media
  if (Array.isArray(media)) {
    for (const item of media) {
      if (typeof item === 'string') push(item)
      else if (item && typeof item === 'object') {
        push(item.url)
        push(item.src)
        push(item.mediaUrl)
        push(item.publicUrl)
      }
    }
  }
  for (const p of post.providers || []) push(p.publicUrl)
  return [...new Set(urls)]
}

function summarizePost(post) {
  const providers = (post.providers || []).map((p) => ({
    network: p.network,
    status: p.status,
    url: p.publicUrl || null,
  }))
  const published = (post.providers || []).some((p) => p.status === 'PUBLISHED')
  return {
    id: post.id ?? post.uuid,
    date: post.publicationDate?.dateTime || post.date || null,
    draft: !!post.draft,
    published,
    networks: providers.map((p) => p.network),
    providers,
    text: (post.text || '').trim().slice(0, 400),
    media: mediaUrls(post).slice(0, 8),
  }
}

const clients = await rest('clients', {
  select: 'id,name,status,posting_days,posting_time,posting_schedule,metricool_blog_id,platforms,industry,logo_url',
  status: 'eq.active',
  order: 'name.asc',
})

const cadence = requestedClient
  ? clients.filter((c) => c.id === requestedClient || c.name.toLocaleLowerCase() === requestedClient.toLocaleLowerCase())
  : clients.filter((c) => Array.isArray(c.posting_days) && c.posting_days.map(Number).includes(weekday))
if (requestedClient && cadence.length !== 1) throw new Error('Cliente de Metricool no identificado de forma única; usar su nombre exacto o ID')

const startDay = `${dayIso}T00:00:00`
const endDay = `${dayIso}T23:59:59`
const pastStart = new Date(tomorrowLocal)
pastStart.setDate(pastStart.getDate() - 120)
const pastIso = `${pastStart.getFullYear()}-${String(pastStart.getMonth() + 1).padStart(2, '0')}-${String(pastStart.getDate()).padStart(2, '0')}T00:00:00`

const rows = []
for (const client of cadence) {
  const row = {
    id: client.id,
    name: client.name,
    industry: client.industry,
    posting_days: client.posting_days,
    posting_time: client.posting_time,
    platforms: client.platforms,
    metricool_blog_id: client.metricool_blog_id,
    tomorrow: [],
    last10: [],
    metricool_error: null,
  }
  if (!client.metricool_blog_id) {
    row.metricool_error = 'sin metricool_blog_id'
    rows.push(row)
    continue
  }
  if (!historyOnly) {
  const tomorrowJson = await metricool('/v2/scheduler/posts', {
    userId, blogId: String(client.metricool_blog_id), start: startDay, end: endDay, timezone: TZ, extendedRange: 'true',
  })
  if (tomorrowJson.error) {
    row.metricool_error = tomorrowJson.error
    rows.push(row)
    await new Promise((r) => setTimeout(r, 150))
    continue
  }
  row.tomorrow = unwrap(tomorrowJson).filter((p) => !p.draft).map(summarizePost)
  }

  const histJson = await metricool('/v2/scheduler/posts', {
    userId, blogId: String(client.metricool_blog_id), start: pastIso, end: historyOnly ? new Date().toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') : startDay, timezone: TZ, extendedRange: 'true',
  })
  if (!histJson.error) {
    row.last10 = unwrap(histJson)
      .filter((p) => !p.draft && (p.providers || []).some((x) => x.status === 'PUBLISHED'))
      .sort((a, b) => String(b.publicationDate?.dateTime || '').localeCompare(String(a.publicationDate?.dateTime || '')))
      .slice(0, 10)
      .map(summarizePost)
  }
  if (histJson.error) row.metricool_error = histJson.error
  rows.push(row)
  process.stderr.write(`${client.name}: mañana ${row.tomorrow.length} · últimos ${row.last10.length}\n`)
  await new Promise((r) => setTimeout(r, 200))
}

const outDir = requestedOut ? resolve(requestedOut) : resolve(root, 'runs/metricool-tomorrow')
mkdirSync(outDir, { recursive: true })
const report = {
  fetched_at: new Date().toISOString(),
  timezone: TZ,
  tomorrow: dayIso,
  weekday: labels[weekday],
  active_clients: clients.length,
  cadence_count: cadence.length,
  clients: rows,
}
writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2))
writeFileSync(resolve(outDir, 'summary.json'), JSON.stringify({
  tomorrow: dayIso,
  weekday: labels[weekday],
  clients: rows.map((r) => ({
    name: r.name,
    time: r.posting_time,
    blog: !!r.metricool_blog_id,
    scheduled_tomorrow: r.tomorrow.length,
    last10: r.last10.length,
    last_dates: r.last10.map((p) => p.date),
    error: r.metricool_error,
  })),
}, null, 2))
console.log(JSON.stringify({
  tomorrow: dayIso,
  weekday: labels[weekday],
  cadence: cadence.length,
  with_metricool: rows.filter((r) => r.metricool_blog_id).length,
  scheduled_posts: rows.reduce((n, r) => n + r.tomorrow.length, 0),
  outfile: 'runs/metricool-tomorrow/summary.json',
}, null, 2))
