/** Client recurrence is independent of actual Metricool publishing status. */
export interface CalendarCadence {
 posting_days?:number[]|null
 posting_time?:string|null
 posting_schedule?:Record<string,string>|null
}
export const CADENCE_DAY_NAMES=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
export function calendarCadenceDays(days:number[]|null|undefined):number[]{
 const unique=new Set((days??[]).filter(day=>Number.isInteger(day)&&day>=0&&day<=6))
 return [1,2,3,4,5,6,0].filter(day=>unique.has(day))
}
function validTime(value:string|null|undefined):string|null{
 const trimmed=value?.trim()??''
 return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(trimmed)?trimmed.slice(0,5):null
}
export function calendarCadenceSlot(client:CalendarCadence,day:number):{time:string|null;format:string|null}|null{
 if(!calendarCadenceDays(client.posting_days).includes(day))return null
 const override=client.posting_schedule?.[String(day)]?.trim()
 const formats:Record<string,string>={reel:'Reel',post:'Post',story:'Story'}
 return {time:validTime(override)??validTime(client.posting_time),format:formats[override?.toLowerCase()??'']??null}
}
