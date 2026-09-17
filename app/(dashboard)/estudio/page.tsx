import { getEditorStudio } from '@/lib/actions/editor-studio'
import { EditorStudio } from '@/components/estudio/editor-studio'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Estudio editor — upload → AI analyze → caption → Metricool DRAFT.
 * Permiso: metricool.draft (editor / supervisor / owner) + video.upload + captions.use.
 */
export default async function EditorStudioPage() {
  const { studio, error } = await getEditorStudio()

  if (error || !studio) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar el Estudio.'}
      </p>
    )
  }

  return <EditorStudio studio={studio} />
}
