import 'server-only'

/** Bearer token for /api/pipeline/operator/*. Fail closed when unset. */
export const PIPELINE_OPERATOR_TOKEN_ENV = 'PIPELINE_OPERATOR_TOKEN'

export function operatorAuthDenial(req: Request): { status: number; body: { error: string } } | null {
  const secret = process.env.PIPELINE_OPERATOR_TOKEN
  if (!secret) {
    return { status: 503, body: { error: 'PIPELINE_OPERATOR_TOKEN no está configurado' } }
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return { status: 401, body: { error: 'No autorizado' } }
  }
  return null
}
