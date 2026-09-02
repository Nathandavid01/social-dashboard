import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AreaAccessPanel } from './area-access-inline'
import { setUserAreaAccess } from '@/lib/actions/users'

vi.mock('@/lib/actions/users', () => ({ setUserAreaAccess: vi.fn(async () => ({ error: null })) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const setAccessMock = vi.mocked(setUserAreaAccess)

describe('AreaAccessPanel', () => {
  beforeEach(() => setAccessMock.mockClear())

  it('starts in "full access" mode when currentAccess is null and hides the checklist', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={null} role="editor" />)
    expect((screen.getByLabelText(/Acceso completo/i) as HTMLInputElement).checked).toBe(true)
    // checklist only appears when restricted
    expect(screen.queryByText('Pipeline')).not.toBeInTheDocument()
  })

  it('reveals the area checklist when restricting', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={null} role="editor" />)
    fireEvent.click(screen.getByLabelText(/Restringir/i))
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
  })

  it('saves null when full access is chosen', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={['/pipeline']} role="editor" />)
    fireEvent.click(screen.getByLabelText(/Acceso completo/i))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(setAccessMock).toHaveBeenCalledWith('u1', null)
  })

  it('saves the selected hrefs when restricted', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={['/pipeline']} role="editor" />)
    // already restricted (non-null access) → checklist visible, /pipeline preselected
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(setAccessMock).toHaveBeenCalledWith('u1', ['/pipeline'])
  })
})

describe('AreaAccessPanel — por grupos', () => {
  it('al restringir, las áreas aparecen agrupadas por sección del menú', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={['/pipeline']} role="editor" />)
    for (const g of ['Marketing', 'Recordings', 'Trabajo', 'Clientes', 'Publicación', 'Métricas', 'Desarrollo', 'Equipo']) {
      expect(screen.getByRole('heading', { name: g })).toBeInTheDocument()
    }
  })

  it('el interruptor del grupo marca y desmarca todas sus áreas', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={['/pipeline']} role="editor" />)
    fireEvent.click(screen.getByRole('button', { name: 'Todo Trabajo' }))
    for (const label of ['Pipeline', 'Banco de Video', 'Revisión', 'Entregas']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).checked).toBe(true)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Nada Trabajo' }))
    for (const label of ['Pipeline', 'Banco de Video', 'Revisión', 'Entregas']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).checked).toBe(false)
    }
  })

  it('muestra cuántas áreas quedan marcadas', () => {
    render(<AreaAccessPanel userId="u1" userName="Ana" currentAccess={['/pipeline', '/banco']} role="editor" />)
    expect(screen.getByText(/2 áreas marcadas/)).toBeInTheDocument()
  })
})
