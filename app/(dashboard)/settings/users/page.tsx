import { createClient } from '@/lib/supabase/server'
import { requirePermission, getCurrentRole, getViewAsEditor } from '@/lib/auth/server'
import { UserAdminTable } from '@/components/team/user-admin-table'
import { PendingApprovals } from '@/components/team/pending-approvals'
import { getPendingApprovals } from '@/lib/actions/approvals'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function SettingsUsersPage() {
  // Owner y supervisor. La contraseña de un owner o supervisor solo la asigna un owner.
  await requirePermission('team.assign_roles')
  const viewingAs = await getViewAsEditor()
  const currentRole = viewingAs ? null : await getCurrentRole()

  const supabase = await createClient()
  const [{ data: { user } }, { data: profiles }, pendingApprovals] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, status, title, avatar_url, area_access')
      .order('full_name'),
    getPendingApprovals(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Usuarios y permisos</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona las cuentas de tu equipo: roles, áreas y acceso. Desde aquí un administrador asigna una contraseña nueva.
        </p>
      </div>
      {pendingApprovals.length > 0 && <PendingApprovals pending={pendingApprovals} />}
      <UserAdminTable
        users={(profiles ?? []) as Profile[]}
        currentUserId={user?.id ?? ''}
        currentRole={currentRole}
      />
    </div>
  )
}
