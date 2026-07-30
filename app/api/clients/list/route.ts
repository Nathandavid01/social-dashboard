import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('status', 'active')
    .order('name')
    .limit(100)

  return NextResponse.json(data ?? [])
}
