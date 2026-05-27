'use server'

import { createDraftPost } from '@/lib/metricool/post'
import { createClient } from '@/lib/supabase/server'

export async function sendCaptionToDraft(
  caption: string,
  clientId?: string,
  platforms?: string[]
): Promise<{ success: boolean; draftId?: string | number; error?: string }> {
  try {
    const supabase = await createClient()

    let blogId: string | undefined
    if (clientId) {
      const { data } = await supabase
        .from('clients')
        .select('metricool_blog_id, platforms')
        .eq('id', clientId)
        .single()
      blogId = data?.metricool_blog_id ?? undefined
      if (!platforms?.length) platforms = data?.platforms ?? undefined
    }

    const draft = await createDraftPost(caption, blogId, platforms)
    const draftId = draft.data?.id ?? draft.data?.uuid

    return { success: true, draftId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
