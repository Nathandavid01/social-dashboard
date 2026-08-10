import * as Sentry from '@sentry/nextjs'
import { buildSentryOptions } from '@/lib/observability/sentry-options'

Sentry.init(buildSentryOptions({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  nodeEnv: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
}))

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
