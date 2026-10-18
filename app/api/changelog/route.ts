import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { APP_VERSION } from '@/lib/version'
import { entriesToShow, parseChangelog } from '@/lib/changelog/entries'

// Las novedades que le faltan por ver a quien abre el dashboard. `since` es la
// última versión que vio (localStorage del navegador); sin él, solo la actual.
// El CHANGELOG.md pesa ~200 KB: se parsea aquí y al cliente van unas pocas.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let md = ''
  try {
    md = await readFile(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  } catch {
    // Nunca `entries: []`: el cliente lo tomaría como «al día» y marcaría la versión vista.
    return NextResponse.json({ error: 'changelog_unavailable' }, { status: 500 })
  }
  const since = new URL(request.url).searchParams.get('since')
  const entries = entriesToShow(parseChangelog(md), { lastSeen: since, current: APP_VERSION })
  return NextResponse.json({ entries })
}
