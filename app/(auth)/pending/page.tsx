import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not signed in → nothing to wait for.
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('approval_status, status, full_name')
    .eq('id', user.id)
    .single()
  const profile = data as Pick<Profile, 'approval_status' | 'status' | 'full_name'> | null

  // Already approved → let them into the app. Rejected → sign out.
  if (profile?.approval_status === 'approved') redirect('/pipeline')
  if (profile?.approval_status === 'rejected') {
    await supabase.auth.signOut()
    redirect('/login?rejected=1')
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Cuenta pendiente de aprobación</CardTitle>
        <CardDescription>
          {profile?.full_name ? `Hola ${profile.full_name}. ` : ''}
          Tu cuenta fue creada y está esperando que un administrador la apruebe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          Recibirás acceso al dashboard en cuanto tu cuenta sea aprobada. Si crees
          que esto es un error, contacta al equipo de Nate Media.
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
