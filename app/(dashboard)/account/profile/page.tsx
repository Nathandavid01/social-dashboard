import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssignedRecordings } from '@/components/recording/assigned-recordings'
export const dynamic = 'force-dynamic'
export default async function ProfilePage() {
 const db = await createClient()
 const { data: { user } } = await db.auth.getUser()
 if (!user) redirect('/login')
 const { data: profile } = await db.from('profiles').select('full_name').eq('id',user.id).single()
 return <div className="space-y-6"><header><h1 className="text-2xl font-semibold">Mi Perfil</h1><p className="mt-2 text-muted-foreground">{profile?.full_name}</p></header><AssignedRecordings /></div>
}
