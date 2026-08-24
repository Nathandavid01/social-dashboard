export const GOOGLE_CALENDAR_HOME_URL = 'https://calendar.google.com/calendar/r'

type CalendarSession = {
  id?: string
  title: string
  session_date: string
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  notes?: string | null
  status?: string | null
}

function compactDay(date: string): string {
  return date.replace(/-/g, '')
}

function compactTime(time: string): string {
  return time.replace(/:/g, '').padEnd(6, '0').slice(0, 6)
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function addHour(time: string): string {
  const [h, min, s] = compactTime(time).match(/.{2}/g)!.map(Number)
  const end = new Date(2000, 0, 1, h + 1, min, s)
  return `${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}${String(end.getSeconds()).padStart(2, '0')}`
}

export function googleCalendarEventUrl(session: CalendarSession): string {
  const params = new URLSearchParams()
  params.set('action', 'TEMPLATE')
  params.set('text', session.title)
  const day = compactDay(session.session_date)
  if (session.start_time) {
    const start = compactTime(session.start_time)
    const end = session.end_time ? compactTime(session.end_time) : addHour(session.start_time)
    params.set('dates', `${day}T${start}/${day}T${end}`)
  } else {
    params.set('dates', `${day}/${compactDay(nextDay(session.session_date))}`)
  }
  if (session.location) params.set('location', session.location)
  if (session.notes) params.set('details', session.notes)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function icsStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function sessionsToIcs(sessions: CalendarSession[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nate Media//Calendario de Grabacion//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const session of sessions) {
    if (session.status === 'cancelled') continue
    const uid = `${session.id ?? session.session_date}@nate-media-recording`
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${icsStamp()}`)
    if (session.start_time) {
      const start = compactTime(session.start_time)
      const end = session.end_time ? compactTime(session.end_time) : addHour(session.start_time)
      lines.push(`DTSTART:${compactDay(session.session_date)}T${start}`)
      lines.push(`DTEND:${compactDay(session.session_date)}T${end}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDay(session.session_date)}`)
    }
    lines.push(`SUMMARY:${icsEscape(session.title)}`)
    if (session.location) lines.push(`LOCATION:${icsEscape(session.location)}`)
    if (session.notes) lines.push(`DESCRIPTION:${icsEscape(session.notes)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
