/** Nombre que ve el equipo mientras sube: el de la idea, no IMG_8841. */
export function videoNameFromIdea(
  ideaTitle: string | null | undefined,
  originalFileName: string,
): string {
  const ext = originalFileName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? ''
  const base = (ideaTitle ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return originalFileName
  return `${base}${ext}`
}
