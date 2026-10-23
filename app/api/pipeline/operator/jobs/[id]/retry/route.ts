import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { generateIdeaCaptionWithClient } from '@/lib/pipeline/idea-caption-generate'
import { isOperatorResponse, operatorGate } from '@/lib/pipeline/operator-http'
import { parseRetry } from '@/lib/pipeline/operator-jobs'
import { retryOperatorJob } from '@/lib/pipeline/operator-service'

export const maxDuration = 300

export async function POST(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const gate = operatorGate(req)
  if (isOperatorResponse(gate)) return gate
  const params = await context.params
  const body = await req.json().catch(() => null)
  const parsed = parseRetry(body, params.id)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await retryOperatorJob(gate.db, params.id, parsed, generateIdeaCaptionWithClient)
  if (result.status === 200) {
    for (const path of ['/revision', '/entregas', '/pipeline', '/mi-dia', '/recibo']) revalidatePath(path)
  }
  return NextResponse.json(result.body, { status: result.status })
}
