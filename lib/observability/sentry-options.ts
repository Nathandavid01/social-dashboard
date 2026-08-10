export interface SentryEnvironmentInput {
  dsn?: string
  enabled?: string
  environment?: string
  nodeEnv?: string
  release?: string
  tracesSampleRate?: string
}

export interface SentryRuntimeOptions {
  dsn: string | undefined
  enabled: boolean
  environment: string
  release: string | undefined
  tracesSampleRate: number
  sampleRate: number
  sendDefaultPii: boolean
  enableLogs: boolean
}

function normalized(value: string | undefined): string | undefined {
  const clean = value?.trim()
  return clean ? clean : undefined
}

function sampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

/** Shared privacy-first defaults for browser, Node.js, and Edge runtimes. */
export function buildSentryOptions(input: SentryEnvironmentInput): SentryRuntimeOptions {
  const dsn = normalized(input.dsn)
  const environment = normalized(input.environment) ?? normalized(input.nodeEnv) ?? 'development'
  const explicitlyDisabled = input.enabled?.trim().toLowerCase() === 'false'

  return {
    dsn,
    enabled: Boolean(dsn) && !explicitlyDisabled,
    environment,
    release: normalized(input.release),
    tracesSampleRate: sampleRate(
      input.tracesSampleRate,
      environment === 'production' ? 0.1 : 1,
    ),
    sampleRate: 1,
    sendDefaultPii: false,
    enableLogs: true,
  }
}
