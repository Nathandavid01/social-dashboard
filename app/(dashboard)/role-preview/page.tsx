import { redirect } from 'next/navigation'
import { Eye } from 'lucide-react'
import { startRolePreview } from '@/lib/actions/role-preview'
import { getActualCurrentRole } from '@/lib/auth/server'
import { Button } from '@/components/ui/button'

export default async function RolePreviewPage() {
  if (process.env.NODE_ENV === 'production') redirect('/home')

  const actualRole = await getActualCurrentRole()
  if (actualRole !== 'owner') redirect('/home')

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Vista de roles</h1>
        </div>
        <p className="text-muted-foreground">
          Simula los permisos y la navegación de otro rol sin cambiar tu cuenta real.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Entrar como editor de video</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usa el rol Editor para revisar contenido, captions, producción y tus videos subidos.
        </p>
        <form action={startRolePreview.bind(null, 'editor')} className="mt-4">
          <Button type="submit">Ver como Editor</Button>
        </form>
      </div>
    </div>
  )
}
