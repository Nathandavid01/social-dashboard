'use client'

import { useState, useEffect } from 'react'
import { isConfigured, getStoredConfig, saveConfig } from '@/lib/metricool/client'
import { MetricoolSetup } from './metricool-setup'
import { MetricoolDashboard } from './metricool-dashboard'

const DEFAULT_CONFIG = {
  userToken: 'ZTHVWXJOYRYXTRNHGEQSYJDKFAYSPTQCXTILGYIJBTGMMUGDTYOTPNVXSHMLGBZG',
  userId: '3746997',
  blogId: '5062650',
}

export function MetricoolPage() {
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

  return <MetricoolDashboard onDisconnect={() => setConnected(false)} />
}
