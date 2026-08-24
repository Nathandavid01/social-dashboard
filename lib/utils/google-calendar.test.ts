import { describe, it, expect } from 'vitest'
import {
  GOOGLE_CALENDAR_HOME_URL,
  googleCalendarEventUrl,
  sessionsToIcs,
} from './google-calendar'

describe('google calendar helpers', () => {
  it('points the card action at Google Calendar', () => {
    expect(GOOGLE_CALENDAR_HOME_URL).toMatch(/^https:\/\/calendar\.google\.com\//)
  })

  it('builds a template URL for one session', () => {
    const url = googleCalendarEventUrl({
      title: 'Grabación Nora',
      session_date: '2026-08-12',
      start_time: '09:30:00',
      end_time: '11:00:00',
      location: 'Blue Chiropractic',
      notes: 'Lista de tomas',
    })
    expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(url).toContain('text=Grabaci')
    expect(url).toContain('dates=20260812T093000')
    expect(url).toContain('location=Blue')
  })

  it('writes an ICS of the visible sessions', () => {
    const ics = sessionsToIcs([
      {
        id: 's1',
        title: 'Grabación Nora',
        session_date: '2026-08-12',
        start_time: null,
        end_time: null,
        location: 'Estudio',
        notes: null,
        status: 'scheduled',
      },
    ])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Grabación Nora')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260812')
    expect(ics).toContain('LOCATION:Estudio')
    expect(ics).toContain('END:VCALENDAR')
  })
})
