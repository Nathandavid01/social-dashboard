import 'server-only'
import {
  buildVideoAnalysisPrompt, buildVideoAnalysisRequest, parseVideoAnalysisResponse,
  filterSceneCutCaptionIssues,
  videoAnalysisModelId, videoAnalysisConfigError,
  type VideoAnalysisContext, type VideoAnalysisFindings, type VideoAnalysisEnv,
} from './video-analysis-core'

export { videoAnalysisModelId, videoAnalysisConfigError } from './video-analysis-core'
export type { VideoAnalysisContext, VideoAnalysisFindings } from './video-analysis-core'

/** Única puerta de red del QC de video. Lanza en config/red/parseo. */
export async function analyzeVideoFrames(
  frames: string[],
  ctx: VideoAnalysisContext,
  timestamps?: number[],
  cuts?: number[],
): Promise<VideoAnalysisFindings> {
  const env = process.env as VideoAnalysisEnv
  const configError = videoAnalysisConfigError(env)
  if (configError) throw new Error(configError)

  const req = buildVideoAnalysisRequest({
    frames,
    timestamps,
    cuts,
    prompt: buildVideoAnalysisPrompt(ctx),
    apiKey: env.XAI_API_KEY!,
    model: videoAnalysisModelId(env),
  })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json().catch(() => null)
  const findings = parseVideoAnalysisResponse(json)
  if (!findings) throw new Error('La IA no devolvió un análisis válido')
  if (!cuts || cuts.length === 0) return findings
  return {
    ...findings,
    burned_captions: {
      ...findings.burned_captions,
      issues: filterSceneCutCaptionIssues(findings.burned_captions.issues, cuts),
    },
  }
}
