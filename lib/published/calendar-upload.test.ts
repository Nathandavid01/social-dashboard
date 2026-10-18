import { describe, it, expect } from 'vitest'
import { validateCalendarUpload, calendarUploadType } from './calendar-upload'
const valid = { title: 'Nueva colección', caption: 'Nuestro próximo post', fileName: 'foto.jpg', mimeType: 'image/jpeg', sizeBytes: 1024, dateTime: '2099-10-20T10:30', platforms: ['instagram'] }
describe('calendar uploads', () => {
 it('accepts raster images and ready videos with explicit formats', () => {
  expect(validateCalendarUpload(valid)).toBeNull()
  expect(calendarUploadType('image/png')).toBe('P')
  expect(calendarUploadType('video/mp4')).toBe('R')
  expect(validateCalendarUpload({ ...valid, fileName: 'corte.mp4', mimeType: 'video/mp4', sizeBytes: 50_000_000 })).toBeNull()
 })
 it.each([{ mimeType: 'text/html' }, { mimeType: 'image/svg+xml' }, { sizeBytes: 0 }, { sizeBytes: 25_000_000 }, { dateTime: '2099-02-30T10:30' }, { platforms: [] }, { caption: '' }])('rejects invalid media/inputs %j', change => expect(validateCalendarUpload({ ...valid, ...change })).toBeTruthy())
})
