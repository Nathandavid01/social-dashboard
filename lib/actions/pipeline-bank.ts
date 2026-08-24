'use server'

import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { getEffectiveRole, getEffectiveUserId, requirePermission } from '@/lib/auth/server'
import {
  groupEditorVideoBank,
  prepareIdeasForEditorBank,
  type EditorBankRow,
} from '@/lib/pipeline/editor-video-bank'

export async function getEditorVideoBank(): Promise<{ rows?: EditorBankRow[]; error?: string }> {
  try {
    await requirePermission('pipeline.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const [role, userId, ideas] = await Promise.all([
    getEffectiveRole(),
    getEffectiveUserId(),
    getIdeacionPipeline({ limit: 400 }),
  ])

  const visible = prepareIdeasForEditorBank(ideas, { role, userId })
  const names = Object.fromEntries(
    visible
      .map((i) => i.assignee)
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => [a.id, a.full_name ?? 'Editor']),
  )
  return { rows: groupEditorVideoBank(visible, names) }
}
