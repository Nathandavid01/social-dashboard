import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

/** Canal fijo de Nate Media para anuncios del dashboard (no inventar webhook). */
export const NATE_SLACK_CHANNEL_ID = 'C0BRP1X3BHQ'
export const NATE_SLACK_CHANNEL_NAME = '#updates-dashboard'
export const NATE_LIVE_ORIGIN = 'http://localhost:3020'

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ kind: 'missing' } | { kind: 'webhook', url: string, channelId: string, channelName: string } | { kind: 'bot', token: string, channelId: string, channelName: string }}
 */
export function resolveSlackTarget(env = process.env) {
  const token = env.SLACK_BOT_TOKEN?.trim()
  const webhook = env.SLACK_COMMIT_WEBHOOK_URL?.trim()
  const channel = {
    channelId: NATE_SLACK_CHANNEL_ID,
    channelName: NATE_SLACK_CHANNEL_NAME,
  }
  if (token) return { kind: 'bot', token, ...channel }
  if (webhook) return { kind: 'webhook', url: webhook, ...channel }
  return { kind: 'missing' }
}

/**
 * @param {string} [route]
 */
export function livePreviewUrl(route = '/') {
  if (route.startsWith('http://') || route.startsWith('https://')) {
    const parsed = new URL(route)
    return `${NATE_LIVE_ORIGIN}${parsed.pathname}${parsed.search}`
  }
  const path = route.startsWith('/') ? route : `/${route}`
  return `${NATE_LIVE_ORIGIN}${path}`
}

/**
 * @param {{ imagePath?: string, route?: string, existsFn?: (p: string) => boolean, captureFn?: (input: { url: string }) => Promise<string | undefined> }} input
 */
export async function resolveAnnouncementImage({
  imagePath,
  route,
  existsFn = existsSync,
  captureFn,
}) {
  if (imagePath && existsFn(imagePath)) return imagePath
  if (route && captureFn) {
    return captureFn({ url: livePreviewUrl(route) })
  }
  return undefined
}

export function formatSlackSetupSteps() {
  return [
    'Crea una Slack app en https://api.slack.com/apps (workspace natemediapr).',
    'En OAuth & Permissions, añade los scopes de bot chat:write y files:write. Reinstala la app.',
    'Invita el bot al canal #updates-dashboard (C0BRP1X3BHQ).',
    'Pon SLACK_BOT_TOKEN=xoxb-... en social-dashboard/.env.local (nunca lo commitees).',
  ]
}

/**
 * @param {{ version?: string, headline: string, explanation: string, route?: string, sha?: string, subject?: string }} input
 */
export function formatCommitAnnouncement({
  version,
  headline,
  explanation,
  route,
  sha,
  subject,
}) {
  const title = version ? `*Nate · v${version}* — ${headline}` : `*Nate* — ${headline}`
  const lines = [title, '', explanation]
  if (route) lines.push('', `• Ruta: \`${route}\``)
  if (sha || subject) {
    const commit = [sha ? `\`${sha}\`` : '', subject ? `— ${subject}` : '']
      .filter(Boolean)
      .join(' ')
    lines.push(`• Commit: ${commit}`)
  }
  return lines.join('\n')
}

/**
 * @param {{ token: string, imagePath: string, message: string, fetchFn: typeof fetch, readFileFn: (p: string) => Buffer }} input
 */
async function uploadScreenshotV2({ token, imagePath, message, fetchFn, readFileFn }) {
  const bytes = readFileFn(imagePath)
  const filename = basename(imagePath) || 'nate-dashboard.png'
  const length = bytes.byteLength ?? bytes.length

  const urlRes = await fetchFn('https://slack.com/api/files.getUploadURLExternal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename, length }),
  })
  if (!urlRes.ok) return { ok: false }
  const urlBody = await urlRes.json().catch(() => ({ ok: false }))
  if (!urlBody?.ok || !urlBody.upload_url || !urlBody.file_id) return { ok: false }

  const putRes = await fetchFn(urlBody.upload_url, {
    method: 'POST',
    body: bytes,
  })
  if (!putRes.ok) return { ok: false }

  const completeRes = await fetchFn('https://slack.com/api/files.completeUploadExternal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [{ id: urlBody.file_id, title: filename }],
      channel_id: NATE_SLACK_CHANNEL_ID,
      initial_comment: message,
    }),
  })
  if (!completeRes.ok) return { ok: false }
  const completeBody = await completeRes.json().catch(() => ({ ok: false }))
  if (completeBody && completeBody.ok === false) return { ok: false }
  return { ok: true, fileId: urlBody.file_id }
}

/**
 * @param {{ env?: Record<string, string | undefined>, message: string, imagePath?: string, fetchFn?: typeof fetch, readFileFn?: (p: string) => Buffer }} input
 */
export async function postCommitAnnouncement({
  env = process.env,
  message,
  imagePath,
  fetchFn = fetch,
  readFileFn = (p) => readFileSync(p),
}) {
  const target = resolveSlackTarget(env)
  const base = {
    channelId: NATE_SLACK_CHANNEL_ID,
    channelName: NATE_SLACK_CHANNEL_NAME,
  }
  if (target.kind === 'missing') {
    return { ok: true, skipped: true, reason: 'missing_slack', uploaded: false, ...base }
  }

  try {
    if (target.kind === 'webhook') {
      const res = await fetchFn(target.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: NATE_SLACK_CHANNEL_ID,
          text: message,
        }),
      })
      if (!res.ok) return { ok: false, skipped: false, reason: 'slack_error', uploaded: false, ...base }
      return { ok: true, skipped: false, uploaded: false, ...base }
    }

    if (imagePath) {
      const uploaded = await uploadScreenshotV2({
        token: target.token,
        imagePath,
        message,
        fetchFn,
        readFileFn,
      })
      if (!uploaded.ok) {
        return { ok: false, skipped: false, reason: 'slack_error', uploaded: false, ...base }
      }
      return {
        ok: true,
        skipped: false,
        uploaded: true,
        fileId: uploaded.fileId,
        ...base,
      }
    }

    const res = await fetchFn('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${target.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: NATE_SLACK_CHANNEL_ID,
        text: message,
      }),
    })
    if (!res.ok) return { ok: false, skipped: false, reason: 'slack_error', uploaded: false, ...base }
    const body = await res.json().catch(() => ({ ok: false }))
    if (body && body.ok === false) {
      return { ok: false, skipped: false, reason: 'slack_error', uploaded: false, ...base }
    }
    return { ok: true, skipped: false, uploaded: false, ...base }
  } catch {
    return { ok: false, skipped: false, reason: 'slack_error', uploaded: false, ...base }
  }
}

/**
 * @param {{ url: string }} input
 */
export async function captureLiveRoute({ url }) {
  const dest = join(tmpdir(), `nate-announce-${Date.now()}.png`)
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page.screenshot({ path: dest, fullPage: false })
    return dest
  } finally {
    await browser.close()
  }
}

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    if (!key.startsWith('--')) continue
    const name = key.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    out[name] = value
  }
  return out
}

function readAppVersion() {
  try {
    const src = readFileSync(new URL('../lib/version.ts', import.meta.url), 'utf8')
    return src.match(/APP_VERSION = '([^']+)'/)?.[1] ?? ''
  } catch {
    return ''
  }
}

function printSetupSteps() {
  console.warn(`Slack no está en .env.local (SLACK_BOT_TOKEN). El commit no se bloquea.`)
  console.warn(`Para adjuntar screenshots a ${NATE_SLACK_CHANNEL_NAME} (${NATE_SLACK_CHANNEL_ID}):`)
  for (const [i, step] of formatSlackSetupSteps().entries()) {
    console.warn(`${i + 1}. ${step}`)
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  const { loadEnvConfig } = nextEnv
  loadEnvConfig(process.cwd())
  const args = parseArgs(process.argv.slice(2))
  const message =
    args.message ||
    formatCommitAnnouncement({
      version: args.version || readAppVersion(),
      headline: args.headline || 'Cambio en el dashboard.',
      explanation: args.explanation || 'Revisa la ruta en el preview local (puerto 3020).',
      route: args.route,
      sha: args.sha,
      subject: args.subject,
    })

  let imagePath
  try {
    imagePath = await resolveAnnouncementImage({
      imagePath: args.image,
      route: args.route,
      captureFn: args.image ? undefined : captureLiveRoute,
    })
  } catch {
    console.warn(
      'No se pudo capturar http://localhost:3020. Reusa npm run dev y pasa --image <png>. El commit no se bloquea.',
    )
  }

  const result = await postCommitAnnouncement({
    message,
    imagePath,
  })

  console.log(message)
  console.log('')
  if (result.skipped) {
    printSetupSteps()
    process.exitCode = 0
  } else if (!result.ok) {
    console.warn(`No se pudo postear a ${NATE_SLACK_CHANNEL_NAME}. El commit no se bloquea.`)
    process.exitCode = 0
  } else if (result.uploaded) {
    console.log(
      `Posteado en ${NATE_SLACK_CHANNEL_NAME} (${NATE_SLACK_CHANNEL_ID}) con screenshot.`,
    )
    process.exitCode = 0
  } else {
    console.log(`Posteado en ${NATE_SLACK_CHANNEL_NAME} (${NATE_SLACK_CHANNEL_ID}).`)
    process.exitCode = 0
  }
}
