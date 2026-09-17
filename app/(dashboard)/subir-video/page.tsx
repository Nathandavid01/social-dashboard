import { requirePermission } from '@/lib/auth/server'
import { getEditorUploadStudio } from '@/lib/actions/editor-upload'
import { EditorUploadStudio } from '@/components/editor-upload/editor-upload-studio'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Estudio del editor: subir video (hasta 500 MB) → IA lee → caption →
 * borrador Metricool. Permiso: metricool.draft (editor + admins).
 */
export default async function SubirVideoPage() {
  await requirePermission('metricool.draft')
  const { studio, error } = await getEditorUploadStudio()

  if (error || !studio) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar Subir video.'}
      </p>
    )
  }

  return <EditorUploadStudio studio={studio} />
}
