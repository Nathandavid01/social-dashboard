import { describe, expect, it } from 'vitest'
import {
  classifyVideoLink,
  hasEditingClaimColumns,
  videoLinkLabel,
} from './video-link'

describe('classifyVideoLink', () => {
  it('vincula el video a la idea si la toma viene de una sesión On Site', () => {
    expect(classifyVideoLink({ hasRecordingSession: true })).toBe('linked')
  })

  it('marca Extra si no hay sesión (banco / suelto) o es la librería de B-roll', () => {
    expect(classifyVideoLink({ hasRecordingSession: false })).toBe('extra')
    expect(classifyVideoLink({ hasRecordingSession: true, isBrollLibrary: true })).toBe('extra')
  })
})

describe('videoLinkLabel', () => {
  it('usa copy en español para el editor', () => {
    expect(videoLinkLabel('linked')).toBe('De la idea')
    expect(videoLinkLabel('extra')).toBe('Extra')
  })
})

describe('hasEditingClaimColumns', () => {
  it('sin columnas de claim no se activa la UI extra', () => {
    expect(hasEditingClaimColumns({ title: 'Reel' })).toBe(false)
    expect(hasEditingClaimColumns(null)).toBe(false)
  })

  it('reconoce las columnas si existen en la fila', () => {
    expect(hasEditingClaimColumns({ editing_started_at: '2026-09-21T12:00:00Z' })).toBe(true)
    expect(hasEditingClaimColumns({ editing_started_by: 'u1' })).toBe(true)
  })
})
