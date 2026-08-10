'use client'

import { useEffect } from 'react'
import { isRecoveryLink } from '@/lib/utils/recovery-core'

export default function Home() {
  useEffect(() => {
    // Supabase's implicit recovery flow returns tokens in the URL fragment,
    // which never reaches the server. Hand it to the dedicated recovery page.
    if (isRecoveryLink(window.location.href)) {
      window.location.replace(`/update-password${window.location.search}${window.location.hash}`)
      return
    }

    // Landing: lo que cada persona tiene que hacer hoy.
    window.location.replace('/mi-dia')
  }, [])

  return null
}
