import type { DuplicateVideo } from '@/lib/actions/video-dedupe'

/** "Ya subido para «Intro clínica» (ARASIBO) el 28 ago por Carlos" — lo que ve quien intenta repetir. */
export function duplicateVideoMessage(dup: DuplicateVideo): string {
  const fecha = new Date(dup.uploadedAt)
  const cuando = Number.isNaN(fecha.getTime())
    ? ''
    : ` el ${fecha.toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })}`
  const cliente = dup.clientName ? ` (${dup.clientName})` : ''
  const quien = dup.uploadedBy ? ` por ${dup.uploadedBy}` : ''
  return `Ya subido para «${dup.ideaTitle || dup.fileName}»${cliente}${cuando}${quien}`
}
