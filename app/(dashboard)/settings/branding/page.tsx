import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { AgencyBrandingForm } from '@/components/settings/agency-branding-form'
import { getCurrentRole } from '@/lib/auth/server'
import { getAgencyBranding } from '@/lib/actions/agency-branding'

export const dynamic = 'force-dynamic'

export default async function BrandingSettingsPage() {
  const role = await getCurrentRole()
  if (role !== 'owner') redirect('/home')

  const branding = await getAgencyBranding()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marca del dashboard"
        description="Elige el logo de Nate Media o el de tu agencia, el nombre, el eslogan y el color de acento. Solo Owners pueden cambiar la identidad."
      />
      <SettingsTabs />
      <AgencyBrandingForm initial={branding} />
    </div>
  )
}
