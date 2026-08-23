import { describe, expect, it, vi } from 'vitest'
import {
  NATE_SLACK_CHANNEL_ID,
  NATE_SLACK_CHANNEL_NAME,
  formatCommitAnnouncement,
  resolveSlackTarget,
  postCommitAnnouncement,
} from './announce-commit.mjs'

describe('announce-commit Slack target', () => {
  it('siempre apunta al canal de updates del dashboard de Nate Media', () => {
    expect(NATE_SLACK_CHANNEL_NAME).toBe('#updates-dashboard')
    expect(NATE_SLACK_CHANNEL_ID).toBe('C0BRP1X3BHQ')
  })

  it('sin credenciales, avisa y no inventa webhook', () => {
    expect(resolveSlackTarget({})).toEqual({ kind: 'missing' })
    expect(resolveSlackTarget({ SLACK_COMMIT_WEBHOOK_URL: '   ' })).toEqual({ kind: 'missing' })
  })

  it('usa webhook si existe, pero el texto siempre nombra el canal fijo', () => {
    expect(
      resolveSlackTarget({
        SLACK_COMMIT_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/xxx',
      }),
    ).toEqual({
      kind: 'webhook',
      url: 'https://hooks.slack.com/services/T/B/xxx',
      channelId: 'C0BRP1X3BHQ',
      channelName: '#updates-dashboard',
    })
  })

  it('usa bot token para adjuntar imagen al canal fijo', () => {
    expect(
      resolveSlackTarget({
        SLACK_BOT_TOKEN: 'xoxb-test',
        SLACK_COMMIT_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/xxx',
      }),
    ).toEqual({
      kind: 'bot',
      token: 'xoxb-test',
      channelId: 'C0BRP1X3BHQ',
      channelName: '#updates-dashboard',
    })
  })
})

describe('formatCommitAnnouncement', () => {
  it('arma el copy en español con versión, función y ruta', () => {
    const text = formatCommitAnnouncement({
      version: '3.71',
      headline: 'Desde el día del calendario, el admin asigna quién va a grabar y en qué lugar.',
      explanation:
        'Owner y supervisor eligen videógrafo y sitio al pulsar la sesión. Quien graba lo ve y no lo cambia.',
      route: '/recording-calendar',
      sha: 'abc1234',
      subject: 'asignar videógrafo desde el día',
    })

    expect(text).toContain('*Nate · v3.71*')
    expect(text).toContain('quién va a grabar')
    expect(text).toContain('`/recording-calendar`')
    expect(text).toContain('`abc1234`')
    expect(text).not.toContain('.env')
  })
})

describe('postCommitAnnouncement', () => {
  it('sin Slack configurado, no lanza y sale ok', async () => {
    const fetchFn = vi.fn()
    const result = await postCommitAnnouncement({
      env: {},
      message: 'hola',
      fetchFn,
    })
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: 'missing_slack',
      channelId: 'C0BRP1X3BHQ',
      channelName: '#updates-dashboard',
    })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('Slack 5xx no lanza: avisa y sigue', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'down',
    })
    const result = await postCommitAnnouncement({
      env: { SLACK_COMMIT_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/xxx' },
      message: 'hola',
      fetchFn,
    })
    expect(result.ok).toBe(false)
    expect(result.skipped).toBe(false)
    expect(result.reason).toBe('slack_error')
  })
})
