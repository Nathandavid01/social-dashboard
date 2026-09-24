import { describe, expect, it } from 'vitest'
import { planReciboCaption } from './caption-plan'

const base = {
  title: 'Nigiri Y Sashimi',
  hook: 'El corte del día',
  generatedCaption: null,
  captionDraft: null,
  hasEdited: true,
  metricoolBlogId: null,
  matchedBlogId: '7054368',
}

describe('planReciboCaption', () => {
  it('no pisa un caption ya guardado ni un borrador', () => {
    expect(planReciboCaption({ ...base, generatedCaption: 'Ya publicado' })).toEqual({
      action: 'skip',
      caption: 'Ya publicado',
    })
    expect(planReciboCaption({ ...base, captionDraft: 'Borrador listo' })).toEqual({
      action: 'skip',
      caption: 'Borrador listo',
    })
  })

  it('usa el título como tema cuando no hay hook y enlaza Metricool si faltaba', () => {
    expect(planReciboCaption({ ...base, hook: '  ' })).toEqual({
      action: 'fill',
      hookToSet: 'Nigiri Y Sashimi',
      blogIdToSet: '7054368',
    })
  })

  it('no vuelve a escribir el blog si el cliente ya lo tiene', () => {
    expect(planReciboCaption({ ...base, metricoolBlogId: '111' }).action).toBe('fill')
    expect(planReciboCaption({ ...base, metricoolBlogId: '111' })).toMatchObject({ blogIdToSet: null })
  })

  it('se detiene sin editado, sin tema o sin marca de Metricool', () => {
    expect(planReciboCaption({ ...base, hasEdited: false })).toMatchObject({ action: 'blocked' })
    expect(planReciboCaption({ ...base, hook: '', title: '' })).toMatchObject({ action: 'blocked' })
    expect(planReciboCaption({ ...base, matchedBlogId: null })).toMatchObject({ action: 'blocked' })
  })
})
