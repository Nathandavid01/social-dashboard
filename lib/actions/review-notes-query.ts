import type { SupabaseClient } from '@supabase/supabase-js'
import { latestNoteByIdea, type ReviewNote, type ReviewNoteRow } from './review-notes-core'

/** Server read using the caller's authenticated client and already-visible idea ids. */
export async function getCompleteReviewNotes(
  supabase: SupabaseClient,
  ideaIds: string[],
): Promise<Record<string, ReviewNote>> {
  const ids = [...new Set(ideaIds)]
  const notes: Record<string, ReviewNote> = {}
  for (let start = 0; start < ids.length; start += 100) {
    let expected: number | null = null
    let loaded = 0
    const seen = new Set<string>()
    for (let offset = 0; ; offset += 500) {
      const { data, count, error } = await supabase
        .from('content_idea_activity')
        .select('id, content_idea_id, metadata, created_at, user:profiles(full_name)', { count: 'exact' })
        .in('action', ['changes_requested', 'client_requested_changes'])
        .in('content_idea_id', ids.slice(start, start + 100))
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + 499)
      if (error || !data || count == null || (expected !== null && count !== expected)) {
        throw new Error('No se pudieron cargar todas las correcciones. Vuelve a cargar Revisión.')
      }
      expected = count
      for (const row of data) {
        if (seen.has(row.id)) throw new Error('El historial cambió durante la consulta. Vuelve a cargar Revisión.')
        seen.add(row.id)
      }
      const pageNotes = latestNoteByIdea(data as unknown as ReviewNoteRow[])
      for (const [id, note] of Object.entries(pageNotes)) {
        if (!notes[id] || note.at > notes[id].at) notes[id] = note
      }
      loaded += data.length
      if (loaded === expected) break
      if (loaded > expected || !data.length || offset >= 99500) {
        throw new Error('No se pudieron cargar todas las correcciones. Vuelve a cargar Revisión.')
      }
    }
  }
  return notes
}
