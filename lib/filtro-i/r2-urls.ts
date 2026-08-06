import 'server-only'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { entregasR2Client, entregasR2Bucket } from '@/lib/integrations/entregas-r2'

/**
 * URLs firmadas para Filtro I.
 *
 * Módulo propio en vez de tocar `lib/actions/entregas-r2.ts`: aquel gatea por
 * `revision.read`/`entregas.read` y Filtro I tiene su propio permiso. Lee la
 * MISMA configuración de bucket (`entregasR2Client`) sin modificarla, así que
 * los videos siguen viviendo donde ya vivían.
 *
 * Nada de esto comprueba permisos — es plomería interna. El gate va en la
 * server action y en el endpoint que llaman aquí.
 */

/** Una hora: sobra para que WhisperAPI y xAI descarguen lo suyo. */
const EXPIRA_SEG = 60 * 60

/** Dónde vive el frame N de un video en el bucket. */
export function claveFrame(ideaId: string, videoId: string, indice: number): string {
  // Fuera de /edited/ a propósito: ese prefijo es lo que el Worker público
  // expone, y los frames son material interno de revisión.
  return `entregas/${ideaId}/filtro-i/${videoId}/${String(indice).padStart(3, '0')}.jpg`
}

async function firmar(
  cmd: PutObjectCommand | GetObjectCommand,
): Promise<string | null> {
  const client = entregasR2Client()
  if (!client) return null
  try {
    return await getSignedUrl(client, cmd, { expiresIn: EXPIRA_SEG })
  } catch {
    return null
  }
}

/** PUT para que el navegador suba un frame recién sacado del <canvas>. */
export function firmarPutFrame(key: string): Promise<string | null> {
  return firmar(
    new PutObjectCommand({ Bucket: entregasR2Bucket(), Key: key, ContentType: 'image/jpeg' }),
  )
}

/**
 * GET temporal de un objeto. Es una URL pública con firma y caducidad — que es
 * exactamente lo que necesitan WhisperAPI (para bajar el video) y xAI (para
 * leer los frames) sin que el bucket deje de ser privado.
 */
export function firmarGet(key: string): Promise<string | null> {
  return firmar(new GetObjectCommand({ Bucket: entregasR2Bucket(), Key: key }))
}
