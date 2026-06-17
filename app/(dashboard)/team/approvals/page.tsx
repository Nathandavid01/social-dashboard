import { requirePermission } from '@/lib/auth/server'
import { getPendingApprovals } from '@/lib/actions/approvals'
import { PendingApprovals } from '@/components/team/pending-approvals'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  await requirePermission('team.assign_roles')
  const pending = await getPendingApprovals()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Aprobaciones de cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Revisa y aprueba a las personas que solicitaron acceso al dashboard.
        </p>
      </div>
      <PendingApprovals pending={pending} />
    </div>
  )
}
