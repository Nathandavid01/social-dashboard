/**
 * Twilio Programmable Messaging — sends SMS via REST API.
 * No Twilio SDK required; uses fetch + Basic auth.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID   — starts with AC…
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   — E.164 format (e.g. +17875551234)
 *
 * Optional:
 *   TWILIO_MESSAGING_SERVICE_SID — if set, used instead of from number
 */

export interface SendSmsResult {
  sid?: string
  status?: string
  error?: string
}

export interface TwilioConfig {
  accountSid: string
  authToken: string
  fromNumber?: string
  messagingServiceSid?: string
}

export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) return null
  return { accountSid, authToken, fromNumber, messagingServiceSid }
}

export async function sendSms({ to, body }: { to: string; body: string }): Promise<SendSmsResult> {
  const cfg = getTwilioConfig()
  if (!cfg) return { error: 'Twilio no está configurado (faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER en env).' }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`
  const params = new URLSearchParams()
  params.set('To', to)
  params.set('Body', body)
  if (cfg.messagingServiceSid) params.set('MessagingServiceSid', cfg.messagingServiceSid)
  else if (cfg.fromNumber) params.set('From', cfg.fromNumber)

  const basic = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const json = (await res.json()) as { sid?: string; status?: string; message?: string; code?: number }
    if (!res.ok) {
      return { error: json.message ?? `Twilio responded ${res.status}` }
    }
    return { sid: json.sid, status: json.status }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

/**
 * Best-effort phone normalization to E.164.
 * If the input already starts with +, return as-is (trimmed).
 * If it's a 10-digit US/PR number, prefix +1.
 * Otherwise return null — caller should validate.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry = '+1'): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `${defaultCountry}${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}
