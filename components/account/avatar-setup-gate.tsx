'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { AvatarSetupDialog } from './avatar-setup-dialog'

// Per-session dismissal: "Más tarde" hides it for this session, but a fresh
// login (new session) asks again — so it keeps asking until an avatar is set.
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
 * On login, nudges users without an avatar to create one. Optional ("Más
 * tarde") and reappears each session until they set one.
 */
export function AvatarSetupGate() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (profile && !profile.avatar_url && !isDismissed()) setOpen(true)
  }, [profile])

  if (!profile || profile.avatar_url) return null

  return (
    <AvatarSetupDialog
      open={open}
      onOpenChange={setOpen}
      name={profile.full_name ?? ''}
      email={profile.email ?? ''}
      onLater={markDismissed}
      onSaved={() => {
        markDismissed()
        setOpen(false)
      }}
    />
  )
}
