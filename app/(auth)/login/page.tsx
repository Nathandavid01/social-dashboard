import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { deactivated?: string; rejected?: string; reset?: string }
}) {
  if (searchParams?.reset) {
    return (
      <>
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Contraseña actualizada. Ya puedes iniciar sesión.
        </div>
        <LoginForm />
      </>
    )
  }

  return (
    <>
      {searchParams?.deactivated && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Tu cuenta fue desactivada. Contacta a un administrador.
        </div>
      )}
      {searchParams?.rejected && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Tu solicitud de acceso no fue aprobada. Contacta a un administrador.
        </div>
      )}
      <LoginForm />
    </>
  )
}
