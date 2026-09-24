import { describe, expect, it } from 'vitest'
import { ERIC_IDS, reciboBoardIdeas } from './board-ideas'

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

  // Eric 2026-09-24: «quiero que puedas poner en recibo los videos que yo edito aunque el cliente sea de un editor».
  it('deja el corte que subió Eric aunque el cliente sea de un editor humano, y solo ese corte', () => {
    const [eric] = [...ERIC_IDS]
    const deEric = {
      ...edited,
      id: 'de-eric',
      client_id: 'human',
      videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded', uploaded_by: eric }],
    }
    const deAlexa = {
      ...edited,
      id: 'de-alexa',
      client_id: 'human',
      videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded', uploaded_by: 'alexa' }],
    }
    expect(reciboBoardIdeas([deEric, deAlexa], ['ai']).map((idea) => idea.id)).toEqual(['de-eric'])
  })

  it('un corte de Eric archivado, o ya programado, no entra', () => {
    const [eric] = [...ERIC_IDS]
    const archivado = {
      ...edited,
      id: 'arch',
      client_id: 'human',
      videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'archived', uploaded_by: eric }],
    }
    const agendado = {
      ...edited,
      id: 'agendado',
      client_id: 'human',
      staff_client_approval: 'approved',
      metricool_post_id: 9,
      videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded', uploaded_by: eric }],
    }
    expect(reciboBoardIdeas([archivado, agendado], ['ai'])).toEqual([])
  })
})
