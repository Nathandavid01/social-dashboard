import { ChangePasswordForm } from '@/components/auth/change-password-form'

export const dynamic = 'force-dynamic'

export default function AccountSecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Seguridad de la cuenta</h1>
        <p className="text-sm text-muted-foreground">Cambia la contraseña de tu cuenta.</p>
      </div>
      <ChangePasswordForm />
    </div>
  )
}
