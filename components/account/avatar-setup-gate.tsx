'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { hasRealAvatar, shouldPromptForAvatar } from '@/lib/utils/avatar-core'
import { AvatarSetupDialog } from './avatar-setup-dialog'

// Per-session only: "Ahora no" hides it until the next visit / new login.
const DISMISS_KEY = 'nm_avatar_prompt_dismissed'

function isDismissed(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage?.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}
function markDismissed() {
  try {
    window.sessionStorage?.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * After login, blocks users without a real photo/avatar. They can postpone
 * this visit once; the next time they enter, we ask again.
 */
export function AvatarSetupGate() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [postponed, setPostponed] = useState(false)

  useEffect(() => {
    setPostponed(isDismissed())
  }, [])

  useEffect(() => {
    if (profile && shouldPromptForAvatar(profile.avatar_url, postponed || isDismissed())) {
      setOpen(true)
    }
  }, [profile, postponed])

  if (!profile || hasRealAvatar(profile.avatar_url) || postponed) return null

  return (
    <AvatarSetupDialog
      open={open}
      onOpenChange={setOpen}
      name={profile.full_name ?? ''}
      email={profile.email ?? ''}
      onLater={() => {
        markDismissed()
        setPostponed(true)
      }}
      onSaved={() => {
        setOpen(false)
      }}
    />
  )
}
