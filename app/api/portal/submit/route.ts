import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS for portal submissions
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const URGENCY_TO_PRIORITY: Record<string, number> = {
  urgent: 1,
  high: 1,
  normal: 2,
  low: 3,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      company_name: string
      contact_name: string
      contact_email?: string
      contact_phone?: string
      request_type: string
      urgency: string
      description: string
    }

    const { company_name, contact_name, request_type, urgency, description } = body

    if (!company_name?.trim() || !contact_name?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Campos requeridos incompletos.' }, { status: 400 })
    }

    if (description.length > 1000) {
      return NextResponse.json({ error: 'Descripción demasiado larga.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Insert into client_requests table (anon policy allows this)
    const { error: reqError } = await supabase
      .from('client_requests')
      .insert({
        company_name: company_name.trim(),
        contact_name: contact_name.trim(),
        contact_email: body.contact_email?.trim() || null,
        contact_phone: body.contact_phone?.trim() || null,
        request_type: request_type || 'other',
        urgency: urgency || 'normal',
        description: description.trim(),
        status: 'new',
      })

    if (reqError) {
      console.error('Portal submit error:', reqError)
      // If client_requests table doesn't exist yet (migration not applied),
      // fall through gracefully
      if (reqError.code === '42P01') {
        return NextResponse.json(
          { error: 'El portal requiere una configuración de base de datos. Contacta al equipo directamente.' },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }

    // Also create a team alert so the team sees it immediately
    const priority = URGENCY_TO_PRIORITY[urgency] ?? 2
    const severity = priority === 1 ? 'error' : priority === 2 ? 'warning' : 'info'
    const urgencyLabel = urgency === 'urgent' ? '🔴 URGENTE' : urgency === 'high' ? '🟠 Alta' : urgency === 'normal' ? '🟡 Normal' : '🟢 Baja'

    await supabase.from('alerts').insert({
      title: `📋 Nueva solicitud de cliente: ${company_name.trim()}`,
      message: `${urgencyLabel} · ${contact_name.trim()} solicitó: ${description.trim().slice(0, 120)}${description.length > 120 ? '…' : ''}`,
      severity,
      created_by: null,
    }).throwOnError()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Portal error:', err)
    return NextResponse.json(
      { error: 'Error interno. Por favor intenta de nuevo.' },
      { status: 500 }
    )
  }
}
