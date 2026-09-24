import { describe, expect, it } from 'vitest'
import { reciboBoardIdeas } from './board-ideas'

const edited = {
  id: 'cut',
  client_id: 'ai',
  status: 'producida',
  published_at: null,
  manual_posted_status: null,
  metricool_post_id: null,
  posted_at: null,
  staff_client_approval: null,
  videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded' }],
}

describe('reciboBoardIdeas', () => {
  it('deja el video por aprobar y el aprobado que falta por programar', () => {
    const listo = { ...edited, id: 'listo', staff_client_approval: 'approved' }
    const human = { ...edited, id: 'human', client_id: 'human', staff_client_approval: 'approved' }
    expect(reciboBoardIdeas([edited, listo, human], ['ai']).map((idea) => idea.id)).toEqual(['cut', 'listo'])
  })

  it('saca la idea sin archivo, lo ya programado en Metricool y lo publicado', () => {
    const bare = { ...edited, id: 'bare', videos: [] }
    const agendado = { ...edited, id: 'agendado', staff_client_approval: 'approved', metricool_post_id: 9 }
    const publicado = { ...edited, id: 'publicado', status: 'publicada' }
    const descartada = { ...edited, id: 'fuera', status: 'descartada' }
    expect(reciboBoardIdeas([bare, agendado, publicado, descartada], ['ai'])).toEqual([])
  })
})
