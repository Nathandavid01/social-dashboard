/**
 * Whitelist de Content-Type para el pipeline de video (audit finding: se
 * podía subir un .html y el proxy lo servía tal cual en el dominio del
 * dashboard — XSS almacenado). Pura, sin dependencias de servidor, para
 * poder usarse tanto al presignar la subida como al servir el archivo.
 */

/** `video/mp4;codecs=avc1` → `video/mp4`. Vacío/null/undefined → ''. */
function normalize(raw: string | null | undefined): string {
  return (raw ?? '').split(';')[0]!.trim().toLowerCase()
}

/**
 * Al SUBIR: solo se acepta un Content-Type que declare ser video/* con un
 * subtipo no vacío. Cubre los tipos concretos que el repo ya maneja
 * (video/mp4, video/quicktime para .mov, video/webm) y variantes de
 * dispositivo (p.ej. video/x-m4v de iPhone) sin necesitar mantener una
 * lista cerrada. Falla cerrado: vacío o no-video → rechazado.
 */
export function isAllowedVideoUploadType(raw: string | null | undefined): boolean {
  const t = normalize(raw)
  return t.startsWith('video/') && t.length > 'video/'.length
}

/**
 * Al SERVIR: nunca confiar en el Content-Type guardado en la fila (pudo
 * subirse antes de este fix, o corromperse). Si no pasa la misma whitelist
 * de video/*, degrada a application/octet-stream — el navegador nunca lo
 * ejecuta ni lo renderiza inline.
 */
export function safeServeContentType(raw: string | null | undefined): string {
  const t = normalize(raw)
  return isAllowedVideoUploadType(t) ? t : 'application/octet-stream'
}
