import { describe, expect, it } from 'vitest'
import {
  CLIENT_BROLL_THEME,
  attachableBankIdeas,
  clientBrollLibraryTitle,
  ideaTitleFromUpload,
  isClientBrollLibrary,
  validateBancoDirectUpload,
  type AttachableBankIdea,
} from './banco-direct-upload'

const mp4 = (name = 'clip.mp4') => ({ name, type: 'video/mp4', size: 1_000 })

describe('ideaTitleFromUpload', () => {
  it('usa el título escrito si hay uno', () => {
    expect(ideaTitleFromUpload('  Sandwich del día  ', [mp4('IMG_8841.MOV')])).toBe('Sandwich del día')
  })

  it('si no hay título, usa el nombre del primer archivo sin extensión', () => {
    expect(ideaTitleFromUpload('  ', [mp4('IMG_8841.MOV'), mp4('otro.mp4')])).toBe('IMG_8841')
    expect(ideaTitleFromUpload(null, [mp4('reel-final.mp4')])).toBe('reel-final')
  })

  it('sin título ni archivos queda vacío', () => {
    expect(ideaTitleFromUpload(undefined, [])).toBe('')
  })
})

describe('validateBancoDirectUpload', () => {
  const base = {
    clientId: 'c1',
    mode: 'new' as const,
    title: 'Toma extra',
    kind: 'raw' as const,
    files: [mp4()],
  }

  it('exige cliente', () => {
    expect(validateBancoDirectUpload({ ...base, clientId: '  ' })).toMatch(/cliente/i)
  })

  it('exige al menos un archivo', () => {
    expect(validateBancoDirectUpload({ ...base, files: [] })).toMatch(/video/i)
  })

  it('rechaza un archivo que no es video', () => {
    expect(validateBancoDirectUpload({
      ...base,
      files: [{ name: 'notas.html', type: 'text/html', size: 20 }],
    })).toMatch(/solo se aceptan videos/i)
  })

  it('en modo existente exige una idea', () => {
    expect(validateBancoDirectUpload({ ...base, mode: 'existing', ideaId: null })).toMatch(/idea/i)
  })

  it('en modo nuevo exige un título o un nombre de archivo', () => {
    expect(validateBancoDirectUpload({ ...base, title: '  ', files: [{ name: '.mp4', type: 'video/mp4', size: 1 }] })).toMatch(/título/i)
  })

  it('acepta un crudo nuevo con título y video', () => {
    expect(validateBancoDirectUpload(base)).toBeNull()
  })

  it('acepta pegar varios archivos a una idea existente', () => {
    expect(validateBancoDirectUpload({
      ...base,
      mode: 'existing',
      ideaId: 'i1',
      files: [mp4('a.mp4'), mp4('b.mov')],
    })).toBeNull()
  })

  it('el B-roll del cliente no pide idea ni título: solo cliente y archivos', () => {
    expect(validateBancoDirectUpload({
      clientId: 'c1',
      mode: 'new',
      title: '',
      kind: 'broll',
      files: [mp4('playa.mp4')],
    })).toBeNull()
  })
})

describe('attachableBankIdeas', () => {
  const ideas: AttachableBankIdea[] = [
    { id: 'keep', title: 'Por editar', clientId: 'c1', status: 'grabada', approval_status: 'pending' },
    { id: 'other-client', title: 'Otro', clientId: 'c2', status: 'idea', approval_status: null },
    { id: 'approved', title: 'Listo', clientId: 'c1', status: 'producida', approval_status: 'approved' },
    { id: 'published', title: 'Al aire', clientId: 'c1', status: 'publicada', approval_status: null },
    { id: 'trashed', title: 'No', clientId: 'c1', status: 'descartada', approval_status: null },
    { id: 'lib', title: 'B-roll de ARASIBO', clientId: 'c1', status: 'idea', approval_status: 'pending', theme: CLIENT_BROLL_THEME },
  ]

  it('solo deja ideas vivas del cliente, no las aprobadas ni descartadas', () => {
    expect(attachableBankIdeas(ideas, 'c1').map((i) => i.id)).toEqual(['keep'])
  })

  it('no ofrece la librería de B-roll como idea de crudo', () => {
    expect(attachableBankIdeas(ideas, 'c1').some((i) => i.id === 'lib')).toBe(false)
  })

  it('sin cliente no hay lista', () => {
    expect(attachableBankIdeas(ideas, '')).toEqual([])
  })
})

describe('librería de B-roll del cliente', () => {
  it('marca la idea sentinela y le pone un título estable', () => {
    expect(isClientBrollLibrary({ theme: CLIENT_BROLL_THEME })).toBe(true)
    expect(isClientBrollLibrary({ theme: 'verano' })).toBe(false)
    expect(clientBrollLibraryTitle('ARASIBO')).toBe('B-roll de ARASIBO')
  })
})
