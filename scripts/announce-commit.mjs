import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

/** Canal fijo de Nate Media para anuncios del dashboard (no inventar webhook). */
export const NATE_SLACK_CHANNEL_ID = 'C0BRP1X3BHQ'
export const NATE_SLACK_CHANNEL_NAME = '#updates-dashboard'

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
 * @param {{ env?: Record<string, string | undefined>, message: string, imagePath?: string, fetchFn?: typeof fetch }} input
 */
export async function postCommitAnnouncement({
  env = process.env,
  message,
  imagePath,
  fetchFn = fetch,
}) {
  const target = resolveSlackTarget(env)
  const base = {
    channelId: NATE_SLACK_CHANNEL_ID,
    channelName: NATE_SLACK_CHANNEL_NAME,
  }
  if (target.kind === 'missing') {
    return { ok: true, skipped: true, reason: 'missing_slack', ...base }
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
      if (!res.ok) return { ok: false, skipped: false, reason: 'slack_error', ...base }
      return { ok: true, skipped: false, ...base }
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
    if (!res.ok) return { ok: false, skipped: false, reason: 'slack_error', ...base }
    const body = await res.json().catch(() => ({ ok: false }))
    if (body && body.ok === false) {
      return { ok: false, skipped: false, reason: 'slack_error', ...base }
    }
    if (imagePath) {
      // Incoming path for agents: Slack MCP no sube archivos; el bot token sí
      // (files.getUploadURLExternal). Sin token, el agente adjunta por MCP si puede.
      void imagePath
    }
    return { ok: true, skipped: false, ...base }
  } catch {
    return { ok: false, skipped: false, reason: 'slack_error', ...base }
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

  const result = await postCommitAnnouncement({
    message,
    imagePath: args.image,
  })

  console.log(message)
  console.log('')
  if (result.skipped) {
    console.warn(
      `Slack no está en .env (SLACK_BOT_TOKEN o SLACK_COMMIT_WEBHOOK_URL). ` +
        `El agente debe postear a ${NATE_SLACK_CHANNEL_NAME} (${NATE_SLACK_CHANNEL_ID}) con Slack MCP.`,
    )
    process.exitCode = 0
  } else if (!result.ok) {
    console.warn(`No se pudo postear a ${NATE_SLACK_CHANNEL_NAME}. El commit no se bloquea.`)
    process.exitCode = 0
  } else {
    console.log(`Posteado en ${NATE_SLACK_CHANNEL_NAME} (${NATE_SLACK_CHANNEL_ID}).`)
    process.exitCode = 0
  }
}
