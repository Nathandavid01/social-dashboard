import { NextResponse } from 'next/server'
import { isOperatorResponse, operatorGate } from '@/lib/pipeline/operator-http'
import { getOperatorJob } from '@/lib/pipeline/operator-service'

export const maxDuration = 60

export async function GET(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const gate = operatorGate(req)
  if (isOperatorResponse(gate)) return gate
  const params = await context.params
  const result = await getOperatorJob(gate.db, params.id)
  return NextResponse.json(result.body, { status: result.status })
}
