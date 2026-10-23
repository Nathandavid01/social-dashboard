import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { isOperatorResponse, operatorGate } from '@/lib/pipeline/operator-http'
import { parseListQuery, parseStartJob } from '@/lib/pipeline/operator-jobs'
import { listOperatorJobs, startOperatorJob } from '@/lib/pipeline/operator-service'

export const maxDuration = 60

function refreshBoards() {
  for (const path of ['/revision', '/entregas', '/pipeline', '/mi-dia', '/recibo']) revalidatePath(path)
}

export async function GET(req: Request) {
  const gate = operatorGate(req)
  if (isOperatorResponse(gate)) return gate
  const parsed = parseListQuery(new URL(req.url).searchParams)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await listOperatorJobs(gate.db, parsed.value)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: Request) {
  const gate = operatorGate(req)
  if (isOperatorResponse(gate)) return gate
  const body = await req.json().catch(() => null)
  const parsed = parseStartJob(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await startOperatorJob(gate.db, parsed.value)
  if (result.status === 201) refreshBoards()
  return NextResponse.json(result.body, { status: result.status })
}
