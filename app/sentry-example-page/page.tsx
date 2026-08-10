import { notFound } from 'next/navigation'
import { SentryTestClient } from './sentry-test-client'

export default function SentryExamplePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return <SentryTestClient />
}
