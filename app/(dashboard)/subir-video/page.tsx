import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Eric: el flujo vive en /primer-round, no en Subir video.
 * Old bookmarks land on the Primer Round studio.
 */
export default function SubirVideoRedirectPage() {
  redirect('/primer-round')
}
