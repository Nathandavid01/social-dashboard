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

  // Eric 2026-09-25: «quiero que cuando se publiquen los videos no aparezcan en recibos».
  it('sale al marcarlo Publicado o al enlazarlo con su post de Metricool (aunque se publicara a mano)', () => {
    const marcado = { ...edited, id: 'marcado', manual_posted_status: 'posted' }
    const enlazado = { ...edited, id: 'enlazado', metricool_post_id: 381555336, posted_at: '2026-09-25T12:00:00Z' }
    const conFecha = { ...edited, id: 'con-fecha', published_at: '2026-09-24T13:59:00Z' }
    const noSePosteo = { ...edited, id: 'no-se-posteo', manual_posted_status: 'not_posted' }
    expect(reciboBoardIdeas([marcado, enlazado, conFecha, noSePosteo], ['ai']).map((idea) => idea.id)).toEqual(['no-se-posteo'])
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

  it('un cliente en pausa no entra, aunque Eric haya subido el corte', () => {
    const [eric] = [...ERIC_IDS]
    const pausado = {
      ...edited,
      id: 'anibal',
      client_id: 'anibal',
      client: { status: 'paused' },
      videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded', uploaded_by: eric }],
    }
    expect(reciboBoardIdeas([pausado], ['ai'])).toEqual([])
  })

  it('Aníbal, Arasibo, VSS y Primer Round no entran solos', () => {
    const [eric] = [...ERIC_IDS]
    const held = ['165b8416-5316-43e1-b6d6-f23caaa57b0c', 'afd0b9e9-efaa-45ac-96c0-d5ee6664c8a8', '8a8f2355-f7e3-403d-96bd-2f1ea1cbd6a6', '7f4a8757-7811-4fb4-afc0-87dc0c50c56d']
    const ideas = held.map((clientId) => ({
      ...edited,
      id: clientId,
      client_id: clientId,
      videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded', uploaded_by: eric }],
    }))
    expect(reciboBoardIdeas(ideas, held)).toEqual([])
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
