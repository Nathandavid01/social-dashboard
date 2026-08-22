import { NextRequest, NextResponse } from 'next/server'
import { generateIdeaBatch } from '@/lib/llm/generate-ideas-run'
import { ideaConfigError } from '@/lib/llm/idea-llm'

export async function POST(req: NextRequest) {
  try {
    const configError = ideaConfigError(process.env)
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 500 })
    }

    const body = await req.json()
    const result = await generateIdeaBatch(body)
    return NextResponse.json({
      ideas: result.ideas,
      model: result.model,
      refined: result.refined,
    })
  } catch (error) {
    console.error('Idea generation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate ideas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
