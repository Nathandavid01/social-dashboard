import { Eye } from 'lucide-react'
import { stopRolePreview } from '@/lib/actions/role-preview'
import { ROLE_LABEL } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/supabase/types'

export function RolePreviewBanner({ role }: { role: UserRole }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950">
      <span className="flex items-center gap-2 font-medium">
        <Eye className="h-4 w-4" aria-hidden="true" />
        Vista de prueba: estás viendo la aplicación como {ROLE_LABEL[role]}.
      </span>
      <form action={stopRolePreview}>
        <button
          type="submit"
          className="rounded-md border border-amber-500 bg-white px-2.5 py-1 font-semibold transition-colors hover:bg-amber-50"
        >
          Volver a Owner
        </button>
      </form>
    </div>
  )
}
