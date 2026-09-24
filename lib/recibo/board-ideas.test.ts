import { describe, expect, it } from 'vitest'
import { reciboBoardIdeas } from './board-ideas'

const edited = {
  id: 'cut',
  client_id: 'ai',
  status: 'producida',
  videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded' }],
}
const bare = { id: 'idea', client_id: 'ai', status: 'idea', videos: [] }
const humanCut = {
  id: 'human',
  client_id: 'human',
  status: 'producida',
  videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded' }],
}

describe('reciboBoardIdeas', () => {
  it('muestra el corte editado del cliente AI y deja fuera la idea sin archivo', () => {
    expect(reciboBoardIdeas([edited, bare, humanCut], ['ai']).map((idea) => idea.id)).toEqual(['cut'])
  })
})
