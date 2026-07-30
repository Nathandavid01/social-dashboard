import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ESTADOS_VIVOS } from '@/lib/clients/estado'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .in('status', ESTADOS_VIVOS)
    .order('name')
    .limit(100)

  return NextResponse.json(data ?? [])
}
