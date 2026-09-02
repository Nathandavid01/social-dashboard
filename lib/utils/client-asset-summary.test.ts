import { describe, it, expect } from 'vitest'
import { summarizeClientAssets } from './client-asset-summary'

describe('summarizeClientAssets', () => {
  it('cuenta logos y detecta la carpeta de B-rolls (enlace sin archivo con "b-roll" en el nombre)', () => {
    const out = summarizeClientAssets([
      { client_id: 'c1', kind: 'logo', name: 'logo.png', url: 'https://s/1', storage_path: 'c1/1' },
      { client_id: 'c1', kind: 'logo', name: 'logo-dark.png', url: 'https://s/2', storage_path: 'c1/2' },
      { client_id: 'c1', kind: 'other', name: 'B-rolls en Drive', url: 'https://drive/x', storage_path: null },
      { client_id: 'c2', kind: 'other', name: 'broll archivo.mp4', url: 'https://s/3', storage_path: 'c2/3' },
    ])
    expect(out.c1).toEqual({ logos: 2, brollFolderUrl: 'https://drive/x' })
    // Un ARCHIVO llamado broll no es la carpeta.
    expect(out.c2).toEqual({ logos: 0, brollFolderUrl: null })
  })
  it('sin filas, sin entradas', () => {
    expect(summarizeClientAssets([])).toEqual({})
  })
})
