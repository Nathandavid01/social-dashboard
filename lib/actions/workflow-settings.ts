'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertOwner } from '@/lib/auth/server'

const patchSchema = z.object({
  weekly_planning_enabled: z.boolean().optional(),
  scheduling_window_days: z.number().int().min(1).max(60).optional(),
  min_ideas_per_session: z.number().int().min(0).max(50).optional(),
  ideas_multiplier: z.number().min(0).max(10).optional(),
  require_rescheduling: z.boolean().optional(),
})

export type WorkflowSettingsPatch = z.input<typeof patchSchema>

export async function updateWorkflowSettings(input: WorkflowSettingsPatch): Promise<{ ok?: true; error?: string }> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const parsed = patchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('workflow_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq('id', 'global')
  if (error) return { error: error.message }

  revalidatePath('/settings/workflow')
  revalidatePath('/planning')
  revalidatePath('/home')
  return { ok: true }
}
