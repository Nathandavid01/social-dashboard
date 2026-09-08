import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssignedRecordings } from '@/components/recording/assigned-recordings'
import { getEffectiveUserId } from '@/lib/auth/server'
import { ROLE_LABEL } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/supabase/types'
export const dynamic = 'force-dynamic'
export default async function ProfilePage() {
 const db = await createClient()
 const { data: { user } } = await db.auth.getUser()
 if (!user) redirect('/login')
 const memberId = await getEffectiveUserId() || user.id
 const { data: profile } = await db.from('profiles').select('full_name,role').eq('id',memberId).single()
 return <div className="space-y-6"><header><h1 className="text-2xl font-semibold">Mi Perfil</h1><p className="mt-2 text-muted-foreground">{profile?.full_name}</p><p className="mt-1 text-sm text-muted-foreground">{profile?.role ? ROLE_LABEL[profile.role as UserRole] : ''}</p></header><AssignedRecordings /></div>
}
