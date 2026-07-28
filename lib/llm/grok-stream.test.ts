import { describe, it, expect } from 'vitest'
import { parseSseTextDeltas } from './grok-stream'

describe('parseSseTextDeltas — SSE de Grok → texto', () => {
  it('saca el texto de un chunk normal', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n'
    expect(parseSseTextDeltas(chunk)).toEqual({ text: 'Hola', rest: '', done: false })
  })

  it('junta varios eventos en un mismo chunk', () => {
    const chunk =
      'data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":" mundo"}}]}\n\n'
    expect(parseSseTextDeltas(chunk).text).toBe('Hola mundo')
  })

  it('guarda el evento incompleto para el próximo chunk', () => {
    const r = parseSseTextDeltas('data: {"choices":[{"delta":{"content":"Ho')
    expect(r.text).toBe('')
    expect(r.rest).toBe('data: {"choices":[{"delta":{"content":"Ho')
  })

  it('un evento partido en dos chunks se recompone', () => {
    const a = parseSseTextDeltas('data: {"choices":[{"delta":{"content":"Ho')
    const b = parseSseTextDeltas(a.rest + 'la"}}]}\n\n')
    expect(b.text).toBe('Hola')
  })

  it('[DONE] cierra el stream', () => {
    const r = parseSseTextDeltas('data: [DONE]\n\n')
    expect(r.done).toBe(true)
    expect(r.text).toBe('')
  })

  it('un delta sin content no aporta texto', () => {
    expect(parseSseTextDeltas('data: {"choices":[{"delta":{}}]}\n\n').text).toBe('')
  })

  it('JSON roto se ignora en vez de tumbar el stream', () => {
    expect(parseSseTextDeltas('data: {roto\n\n').text).toBe('')
  })

  it('líneas vacías y comentarios no molestan', () => {
    const chunk = ': keep-alive\n\ndata: {"choices":[{"delta":{"content":"x"}}]}\n\n'
    expect(parseSseTextDeltas(chunk).text).toBe('x')
  })
})
