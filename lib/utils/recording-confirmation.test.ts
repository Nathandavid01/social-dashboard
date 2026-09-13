import { describe, expect, it } from 'vitest'
import {
  confirmationStatusLabel,
  effectiveConfirmationStatus,
  isRecordingSessionComplete,
  isRecordingSessionIncomplete,
  resolveConfirmationStatus,
} from './recording-confirmation'

describe('recording confirmation helper', () => {
  const complete = {
    client_id: 'c1',
    videographer_id: 'v1',
    start_time: '09:00',
  }

  it('marks complete only when client, videographer and start_time are set', () => {
    expect(isRecordingSessionComplete(complete)).toBe(true)
    expect(isRecordingSessionIncomplete(complete)).toBe(false)
    expect(isRecordingSessionComplete({ ...complete, client_id: null })).toBe(false)
    expect(isRecordingSessionComplete({ ...complete, videographer_id: '' })).toBe(false)
    expect(isRecordingSessionComplete({ ...complete, start_time: '  ' })).toBe(false)
    expect(isRecordingSessionIncomplete({ client_id: 'c1' })).toBe(true)
  })

  it('auto-confirms when all three fields are present', () => {
    expect(resolveConfirmationStatus(complete)).toBe('confirmed')
  })

  it('auto-unconfirms when any required field is missing', () => {
    expect(resolveConfirmationStatus({ ...complete, start_time: null })).toBe('unconfirmed')
    expect(resolveConfirmationStatus({})).toBe('unconfirmed')
  })

  it('honors explicit Confirmar / Unconfirmar', () => {
    expect(resolveConfirmationStatus({ client_id: null }, 'confirmed')).toBe('confirmed')
    expect(resolveConfirmationStatus(complete, 'unconfirmed')).toBe('unconfirmed')
  })

  it('effectiveConfirmationStatus: confirmed via status or complete fields', () => {
    expect(effectiveConfirmationStatus({ confirmation_status: 'confirmed' })).toBe('confirmed')
    expect(effectiveConfirmationStatus(complete)).toBe('confirmed')
    expect(effectiveConfirmationStatus({ ...complete, confirmation_status: 'unconfirmed' })).toBe('confirmed')
    expect(effectiveConfirmationStatus({ client_id: 'c1', confirmation_status: 'unconfirmed' })).toBe('unconfirmed')
    expect(effectiveConfirmationStatus({})).toBe('unconfirmed')
  })

  it('confirmationStatusLabel uses Spanish chips', () => {
    expect(confirmationStatusLabel('confirmed')).toBe('Confirmada')
    expect(confirmationStatusLabel('unconfirmed')).toBe('Sin confirmar')
  })
})
