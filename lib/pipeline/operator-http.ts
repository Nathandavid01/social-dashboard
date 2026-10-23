import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { operatorAuthDenial } from '@/lib/pipeline/operator-auth'

export function operatorGate(req: Request): { db: SupabaseClient } | NextResponse {
  const denied = operatorAuthDenial(req)
  if (denied) return NextResponse.json(denied.body, { status: denied.status })
  const db = createAdminClient()
  if (!db) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })
  }
  return { db }
}

export function isOperatorResponse(value: { db: SupabaseClient } | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}
