export interface ReviewVerification { videoFileId?: string | null; captionsVerified?: boolean; videoVerified?: boolean }
export function reviewQualityError(input: ReviewVerification & {decision:'approve'|'request_changes';note?:string}):string|null {
 if(input.decision==='request_changes') return input.note?.trim()?null:'Explica qué debe corregir el editor.'
 if(input.note?.trim()) return 'Hay comentarios pendientes. Devuelve el video al editor para corregirlos.'
 if(!input.videoFileId) return 'Abre el archivo final antes de aprobar.'
 if(!input.captionsVerified || !input.videoVerified) return 'Confirma los subtítulos visibles y la revisión del video completo.'
 return null
}
