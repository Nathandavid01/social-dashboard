export interface CalendarUploadInput {
 title: string
 caption: string
 fileName: string
 mimeType: string
 sizeBytes: number
 dateTime: string
 platforms: string[]
}
export const CALENDAR_IMAGE_MAX_BYTES = 20 * 1024 * 1024
export const CALENDAR_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024
export function calendarUploadType(mime: string): 'P' | 'R' { return mime.startsWith('video/') ? 'R' : 'P' }
export function calendarMediaError(mime: string, size: number): string | null {
 if (!['image/jpeg','image/png','video/mp4','video/quicktime'].includes(mime)) return 'Elige una imagen JPG/PNG o un video MP4/MOV.'
 if (!Number.isSafeInteger(size) || size <= 0) return 'El archivo está vacío o no es válido.'
 if (size > (mime.startsWith('image/') ? CALENDAR_IMAGE_MAX_BYTES : CALENDAR_VIDEO_MAX_BYTES)) return mime.startsWith('image/') ? 'La imagen debe pesar como máximo 20 MB.' : 'El video debe pesar como máximo 2 GB.'
 return null
}
export function validateCalendarUpload(input: CalendarUploadInput): string | null {
 if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) return 'Escribe un título de hasta 200 caracteres.'
 if (typeof input.caption !== 'string' || !input.caption.trim() || input.caption.length > 20_000) return 'Escribe el caption de la publicación.'
 if (typeof input.fileName !== 'string' || !input.fileName.trim() || input.fileName.length > 255) return 'El nombre del archivo no es válido.'
 const mediaError=calendarMediaError(input.mimeType,input.sizeBytes);if(mediaError)return mediaError
 if (typeof input.dateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.dateTime)) return 'Elige una fecha y hora válidas.'
 const date=new Date(`${input.dateTime}:00Z`)
 if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,16)!==input.dateTime)return 'La fecha y hora no son válidas.'
 if(!Array.isArray(input.platforms) || !input.platforms.length || input.platforms.some(p=>typeof p!=='string'||!p))return 'Elige al menos una red del cliente.'
 return null
}
