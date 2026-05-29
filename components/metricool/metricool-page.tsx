'use client'

import { useState, useEffect } from 'react'
import { isConfigured, getStoredConfig, saveConfig } from '@/lib/metricool/client'
import { MetricoolSetup } from './metricool-setup'
import { MetricoolDashboard } from './metricool-dashboard'
import type { CachedMetricoolProfile } from '@/lib/actions/metricool-profiles'

// Never hardcode the Metricool token in source — it ships to the repo and the
// browser bundle. Sourced from public env (set NEXT_PUBLIC_METRICOOL_* locally /
// in the deployment). Empty → the user is shown the connect form.
const DEFAULT_CONFIG = {
  userToken: process.env.NEXT_PUBLIC_METRICOOL_TOKEN ?? '',
  userId: process.env.NEXT_PUBLIC_METRICOOL_USER_ID ?? '',
  blogId: process.env.NEXT_PUBLIC_METRICOOL_BLOG_ID ?? '',
}

export function MetricoolPage({ cachedProfiles = [] }: { cachedProfiles?: CachedMetricoolProfile[] }) {
  const [connected, setConnected] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!isConfigured()) {
      saveConfig(DEFAULT_CONFIG)
    }
    setConnected(true)
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!connected) {
    return (
      <MetricoolSetup
        onConnected={() => setConnected(true)}
        initialConfig={getStoredConfig()}
      />
    )
  }

  return <MetricoolDashboard onDisconnect={() => setConnected(false)} cachedProfiles={cachedProfiles} />
}
