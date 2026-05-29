import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { deactivated?: string }
}) {
  return (
    <>
      {searchParams?.deactivated && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Tu cuenta fue desactivada. Contacta a un administrador.
        </div>
      )}
      <LoginForm />
    </>
  )
}
