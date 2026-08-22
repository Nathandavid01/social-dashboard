'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, X } from 'lucide-react'
import { useAuth } from '@/lib/context/auth-context'
import { stopViewAs } from '@/lib/actions/view-as'

export function ViewAsBanner() {
  const { viewAsEditor } = useAuth()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (!viewAsEditor) return null

  const name = viewAsEditor.full_name?.trim() || 'un editor'

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 lg:px-6"
    >
      <p className="min-w-0 text-sm text-foreground">
        <Eye className="mr-1.5 inline-block h-4 w-4 align-[-2px] text-amber-600" aria-hidden />
        Viendo como <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground"> · solo sus clientes</span>
      </p>
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-amber-800 hover:bg-amber-500/15 disabled:opacity-60 dark:text-amber-200"
        onClick={() => {
          startTransition(async () => {
            await stopViewAs()
            router.push('/home')
            router.refresh()
          })
        }}
      >
        <X className="h-4 w-4" aria-hidden />
        Salir de esta vista
      </button>
    </div>
  )
}
