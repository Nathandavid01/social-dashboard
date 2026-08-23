import { describe, expect, it, vi } from 'vitest'
import {
  NATE_SLACK_CHANNEL_ID,
  NATE_SLACK_CHANNEL_NAME,
  formatCommitAnnouncement,
  formatSlackSetupSteps,
  livePreviewUrl,
  resolveAnnouncementImage,
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
      uploaded: false,
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

  it('con bot token e imagen, sube por files.getUploadURLExternal al canal fijo', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('files.getUploadURLExternal')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            upload_url: 'https://files.slack.com/upload/v1/TEST',
            file_id: 'F123ABC456',
          }),
        }
      }
      if (String(url).includes('files.slack.com/upload')) {
        return { ok: true, json: async () => ({}) }
      }
      if (String(url).includes('files.completeUploadExternal')) {
        return {
          ok: true,
          json: async () => ({ ok: true, files: [{ id: 'F123ABC456' }] }),
        }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    })

    const result = await postCommitAnnouncement({
      env: { SLACK_BOT_TOKEN: 'xoxb-test' },
      message: 'Nate · v3.71 calendario',
      imagePath: '/tmp/recording-calendar.png',
      fetchFn,
      readFileFn: () => png,
    })

    expect(result.ok).toBe(true)
    expect(result.uploaded).toBe(true)
    expect(result.fileId).toBe('F123ABC456')
    const urls = fetchFn.mock.calls.map((call) => String(call[0]))
    expect(urls.some((u) => u.includes('files.getUploadURLExternal'))).toBe(true)
    expect(urls.some((u) => u.includes('files.completeUploadExternal'))).toBe(true)
    const completeCall = fetchFn.mock.calls.find((call) =>
      String(call[0]).includes('files.completeUploadExternal'),
    )
    const completeBody = JSON.parse(String(completeCall?.[1]?.body))
    expect(completeBody.channel_id).toBe('C0BRP1X3BHQ')
    expect(completeBody.initial_comment).toContain('v3.71')
    expect(completeCall?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: 'Bearer xoxb-test',
      }),
    })
  })

  it('con bot token y sin imagen, postea chat.postMessage al canal fijo', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ts: '1.2' }),
    })
    const result = await postCommitAnnouncement({
      env: { SLACK_BOT_TOKEN: 'xoxb-test' },
      message: 'sin foto',
      fetchFn,
    })
    expect(result.ok).toBe(true)
    expect(result.uploaded).toBe(false)
    expect(String(fetchFn.mock.calls[0][0])).toContain('chat.postMessage')
  })
})

describe('announce-commit screenshot + setup', () => {
  it('la captura viva es localhost:3020, no un HTML estático', () => {
    expect(livePreviewUrl('/recording-calendar')).toBe('http://localhost:3020/recording-calendar')
  })

  it('usa --image si el archivo existe; si no, captura la ruta viva', async () => {
    const captureFn = vi.fn(async () => '/tmp/captured.png')
    const existing = await resolveAnnouncementImage({
      imagePath: '/tmp/given.png',
      route: '/recording-calendar',
      existsFn: (p) => p === '/tmp/given.png',
      captureFn,
    })
    expect(existing).toBe('/tmp/given.png')
    expect(captureFn).not.toHaveBeenCalled()

    const captured = await resolveAnnouncementImage({
      imagePath: undefined,
      route: '/recording-calendar',
      existsFn: () => false,
      captureFn,
    })
    expect(captured).toBe('/tmp/captured.png')
    expect(captureFn).toHaveBeenCalledWith({
      url: 'http://localhost:3020/recording-calendar',
    })
  })

  it('si falta el token, los 4 pasos no inventan un xoxb real', () => {
    const steps = formatSlackSetupSteps()
    expect(steps).toHaveLength(4)
    expect(steps.join('\n')).toContain('chat:write')
    expect(steps.join('\n')).toContain('files:write')
    expect(steps.join('\n')).toContain('#updates-dashboard')
    expect(steps.join('\n')).toContain('SLACK_BOT_TOKEN=xoxb-...')
    expect(steps.join('\n')).not.toMatch(/xoxb-[0-9]/)
  })
})
