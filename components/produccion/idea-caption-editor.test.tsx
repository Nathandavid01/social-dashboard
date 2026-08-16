/**
 * Tests for the caption editor (components/produccion/idea-caption-editor.tsx).
 *
 * Caption único: there is ONE caption per video that goes to ALL the client's
 * networks. The editor must NOT offer a per-platform selector, must say the
 * caption applies to all networks, and (when given the client's platforms)
 * show their badges. AI generation is gated by 'captions.use'.
 *
 * The auth context and server actions are mocked.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { resetAutoDraftAttempts } from '@/lib/hooks/use-auto-draft-caption'
import type { UserRole } from '@/lib/supabase/types'

const generateIdeaCaption = vi.fn(async () => ({ ok: true as const, caption: 'hola' }))
const saveIdeaCaption = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (...a: unknown[]) => generateIdeaCaption(...(a as [])),
  saveIdeaCaption: (...a: unknown[]) => saveIdeaCaption(...(a as [])),
}))
const rateCaption = vi.fn(async () => ({ ok: true as const }))
const getCaptionLearningStats = vi.fn(async () => ({ approved: 0, loved: 0, rejected: 0, suggestions: [] as { phrase: string; count: number }[] }))
const appendClientCaptionRule = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/caption-feedback', () => ({
  rateCaption: (...a: unknown[]) => rateCaption(...(a as [])),
  getCaptionLearningStats: (...a: unknown[]) => getCaptionLearningStats(...(a as [])),
  appendClientCaptionRule: (...a: unknown[]) => appendClientCaptionRule(...(a as [])),
}))

let mockRole: UserRole | null = 'editor'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

// El editor consulta el QC de video con el mismo hook compartido que el
// reporte de análisis (useVideoAnalysisPolling) para saber si la IA ya vio
// el video y así no exigir el hook. Por defecto: sin análisis (comportamiento
// de siempre); los tests de la sección "análisis visual" lo sobreescriben.
let mockAnalysis: { status: 'pending' | 'done' | 'error'; findings: { visual_summary?: string } | null } | null | undefined = null
vi.mock('@/lib/hooks/use-video-analysis-polling', () => ({
  useVideoAnalysisPolling: () => mockAnalysis,
}))

import { packCaptionDrafts } from '@/lib/utils/caption-draft'
import { IdeaCaptionEditor } from './idea-caption-editor'

afterEach(() => {
  cleanup()
  generateIdeaCaption.mockClear()
  resetAutoDraftAttempts()
  mockAnalysis = null
})

describe('IdeaCaptionEditor — caption único', () => {
  it('states the caption applies to all networks and has no per-platform selector', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} />)
    expect(screen.getByText(/una caption para todas las redes/i)).toBeInTheDocument()
    // the old single-platform <Select> combobox must be gone
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('says the caption comes from what the video says', () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" visualBrief="Brief visual" hasVideo />,
    )
    expect(screen.getByText(/lo que se oye en el video/i)).toBeInTheDocument()
    expect(screen.getByText(/la ia escucha el video/i)).toBeInTheDocument()
  })

  it('offers AI generation when the user has captions.use and idea is ready', () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor
        ideaId="i1"
        initialCaption={null}
        hook="Gancho"
        visualBrief="Brief visual"
        hasVideo
      />,
    )
    expect(screen.getByRole('button', { name: /generar desde el video|escribiendo el copy|regenerar con ia/i })).toBeInTheDocument()
  })

  it('enables AI generation with just the topic (hook) — like the idea generator', async () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="solo el tema" hasVideo />)
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalled())
  })

  it('disables AI generation until the topic exists, asking for it in plain Spanish', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hasVideo />)
    expect(screen.getByRole('button', { name: /generar desde el video/i })).toBeDisabled()
    expect(screen.getByText(/di de qué es el video/i)).toBeInTheDocument()
  })

  it('disables AI generation until there is a video', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="solo el tema" hasVideo={false} />)
    expect(screen.getByRole('button', { name: /generar desde el video/i })).toBeDisabled()
    expect(screen.getByText(/sube un video primero/i)).toBeInTheDocument()
  })

  it('shows the client platform badges when provided', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} platforms={['instagram', 'tiktok']} />)
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tiktok/i)).toBeInTheDocument()
    expect(screen.getByText(/un copy por cada red/i)).toBeInTheDocument()
  })

  it('regenerates with the user feedback + the previous caption', async () => {
    mockRole = 'editor'
    generateIdeaCaption.mockClear()
    render(<IdeaCaptionEditor ideaId="i1" initialCaption="Caption viejo" hook="Gancho" visualBrief="Brief" hasVideo />)
    // The feedback control only appears once a caption exists.
    const fb = screen.getByPlaceholderText(/qué cambiar/i)
    fireEvent.change(fb, { target: { value: 'más corto, sin emojis' } })
    fireEvent.click(screen.getByRole('button', { name: /regenerar con feedback/i }))
    await waitFor(() =>
      expect(generateIdeaCaption).toHaveBeenCalledWith('i1', {
        feedback: 'más corto, sin emojis',
        previousCaption: 'Caption viejo',
      }),
    )
  })

  it('hides the feedback control until there is a caption to revise', () => {
    mockRole = 'editor'
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" visualBrief="Brief" hasVideo />)
    expect(screen.queryByRole('button', { name: /regenerar con feedback/i })).not.toBeInTheDocument()
  })

  it('rates a caption 👍 with one click (rating=1)', async () => {
    mockRole = 'editor'
    rateCaption.mockClear()
    render(<IdeaCaptionEditor ideaId="i1" initialCaption="Caption a calificar" hook="Gancho" visualBrief="Brief" hasVideo />)
    fireEvent.click(screen.getByRole('button', { name: /me gusta/i }))
    await waitFor(() =>
      expect(rateCaption).toHaveBeenCalledWith({ ideaId: 'i1', rating: 1, captionText: 'Caption a calificar', note: undefined }),
    )
  })

  it('rates 👎 with a note after revealing the note box', async () => {
    mockRole = 'editor'
    rateCaption.mockClear()
    render(<IdeaCaptionEditor ideaId="i1" initialCaption="Caption a calificar" hook="Gancho" visualBrief="Brief" hasVideo />)
    fireEvent.click(screen.getByRole('button', { name: /no es/i }))
    fireEvent.change(screen.getByPlaceholderText(/qué estuvo mal/i), { target: { value: 'demasiados emojis' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar voto/i }))
    await waitFor(() =>
      expect(rateCaption).toHaveBeenCalledWith({ ideaId: 'i1', rating: -1, captionText: 'Caption a calificar', note: 'demasiados emojis' }),
    )
  })

  it('shows the transparency chip from learning stats', async () => {
    mockRole = 'editor'
    getCaptionLearningStats.mockResolvedValueOnce({ approved: 4, loved: 2, rejected: 1, suggestions: [] })
    render(<IdeaCaptionEditor ideaId="i1" initialCaption="Caption existente" hook="Gancho" visualBrief="Brief" hasVideo />)
    expect(await screen.findByText(/aprendiendo de/i)).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument() // approved 4 + loved 2
  })

  // Editar las reglas del cliente exige clients.brand.edit, que el editor ya no
  // tiene: su alcance es Entregas, no la configuración del cliente.
  it('offers to make a recurring 👎 reason a client rule and calls the action', async () => {
    mockRole = 'supervisor'
    getCaptionLearningStats.mockResolvedValueOnce({ approved: 0, loved: 0, rejected: 3, suggestions: [{ phrase: 'menos emojis', count: 3 }] })
    appendClientCaptionRule.mockClear()
    render(<IdeaCaptionEditor ideaId="i1" initialCaption="Caption existente" hook="Gancho" visualBrief="Brief" hasVideo />)
    const btn = await screen.findByRole('button', { name: /agregar a reglas/i })
    fireEvent.click(btn)
    await waitFor(() => expect(appendClientCaptionRule).toHaveBeenCalledWith({ ideaId: 'i1' }, 'menos emojis'))
  })
})

/**
 * Generar es un BORRADOR. `onSaved` es la señal de "este caption ya es
 * definitivo" — las pantallas que la escuchan sacan el video de la cola de Copy.
 * Dispararla al generar es lo que mandaba videos a Publicación sin revisión.
 */
describe('IdeaCaptionEditor — generar no equivale a guardar', () => {
  it('generar NO avisa onSaved', async () => {
    mockRole = 'editor'
    const onSaved = vi.fn()
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" visualBrief="Brief" hasVideo onSaved={onSaved} />,
    )
    const btn = await screen.findByRole('button', { name: /generar desde el video|regenerar con ia/i })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByDisplayValue('hola')).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('regenerar con feedback tampoco avisa onSaved', async () => {
    mockRole = 'editor'
    const onSaved = vi.fn()
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption="Caption viejo" hook="Gancho" visualBrief="Brief" hasVideo onSaved={onSaved} />,
    )
    fireEvent.change(screen.getByPlaceholderText(/qué cambiar/i), { target: { value: 'más corto' } })
    fireEvent.click(screen.getByRole('button', { name: /regenerar con feedback/i }))
    await waitFor(() => expect(screen.getByDisplayValue('hola')).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('guardar SÍ avisa onSaved con el texto guardado', async () => {
    mockRole = 'editor'
    const onSaved = vi.fn()
    saveIdeaCaption.mockClear()
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" visualBrief="Brief" hasVideo onSaved={onSaved} />,
    )
    fireEvent.change(screen.getByPlaceholderText(/genera el caption/i), { target: { value: 'lo edité a mano' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar caption/i }))
    await waitFor(() => expect(saveIdeaCaption).toHaveBeenCalledWith('i1', 'lo edité a mano'))
    expect(onSaved).toHaveBeenCalledWith('lo edité a mano')
  })

  it('recupera el borrador guardado en la base y lo marca como sin guardar', () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor
        ideaId="i1"
        initialCaption={null}
        initialDraft="borrador de ayer"
        hook="Gancho"
        visualBrief="Brief"
        hasVideo
      />,
    )
    expect(screen.getByDisplayValue('borrador de ayer')).toBeInTheDocument()
    expect(screen.getByText(/sin guardar/i)).toBeInTheDocument()
  })

  it('un caption ya guardado no se anuncia como borrador', () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption="caption definitivo" hook="Gancho" visualBrief="Brief" hasVideo />,
    )
    expect(screen.queryByText(/sin guardar/i)).not.toBeInTheDocument()
  })
})

describe('IdeaCaptionEditor — al abrir se escribe el borrador solo', () => {
  it('genera una vez si hay video + tema y todavía no hay copy', async () => {
    mockRole = 'editor'
    let resolveGen: (v: { ok: true; caption: string }) => void = () => {}
    generateIdeaCaption.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGen = resolve }),
    )
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" hasVideo />)
    expect(await screen.findByText(/escribiendo el copy/i)).toBeInTheDocument()
    expect(generateIdeaCaption).toHaveBeenCalledTimes(1)
    expect(generateIdeaCaption).toHaveBeenCalledWith('i1', { auto: true })
    resolveGen({ ok: true, caption: 'hola' })
    expect(await screen.findByDisplayValue('hola')).toBeInTheDocument()
  })

  it('no pisa un borrador que ya estaba', async () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor
        ideaId="i1"
        initialCaption={null}
        initialDraft="borrador de ayer"
        hook="Gancho"
        hasVideo
      />,
    )
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('borrador de ayer')).toBeInTheDocument()
  })

  it('no pisa un caption ya guardado', async () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption="caption definitivo" hook="Gancho" hasVideo />,
    )
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('caption definitivo')).toBeInTheDocument()
  })

  it('un draft JSON por red se lee como un solo caption, no como bloques por red', () => {
    mockRole = 'editor'
    render(
      <IdeaCaptionEditor
        ideaId="i1"
        initialCaption={null}
        initialDraft={packCaptionDrafts([
          { platform: 'instagram', text: 'hook IG' },
          { platform: 'tiktok', text: 'oral TT' },
        ])}
        hook="Gancho"
        hasVideo
      />,
    )
    const box = screen.getByDisplayValue('hook IG')
    expect(box).toHaveDisplayValue('hook IG')
    expect((box as HTMLTextAreaElement).value).not.toContain('[TikTok]')
    expect((box as HTMLTextAreaElement).value).not.toContain('"by"')
  })

  it('el auto-borrador no avisa onSaved — el video se queda en Copy', async () => {
    mockRole = 'editor'
    const onSaved = vi.fn()
    render(
      <IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" hasVideo onSaved={onSaved} />,
    )
    await waitFor(() => expect(screen.getByDisplayValue('hola')).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })
})

/**
 * El hook ("¿De qué es este video?") deja de ser obligatorio cuando la IA ya
 * vio el video (QC visual 'done' con visual_summary). Decisión de Eric: el
 * campo sigue existiendo para uso manual, con prioridad como contexto.
 */
describe('IdeaCaptionEditor — el análisis visual reemplaza el hook', () => {
  it('sin hook pero con análisis visual done: habilita "Generar desde el video" sin pedir el hook', async () => {
    mockRole = 'editor'
    mockAnalysis = { status: 'done', findings: { visual_summary: 'cocina picanha en parrilla, cierra con el logo' } }
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hasVideo />)
    // Lista → dispara el auto-borrador; se espera a que asiente antes de leer el botón.
    await waitFor(() => expect(screen.getByDisplayValue('hola')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /regenerar con ia/i })).not.toBeDisabled()
    expect(screen.queryByText(/di de qué es el video/i)).not.toBeInTheDocument()
  })

  it('sin hook y sin análisis (pending): sigue pidiendo el hook, como hoy', () => {
    mockRole = 'editor'
    mockAnalysis = { status: 'pending', findings: null }
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hasVideo />)
    expect(screen.getByRole('button', { name: /generar desde el video/i })).toBeDisabled()
    expect(screen.getByText(/di de qué es el video/i)).toBeInTheDocument()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('con hook Y con análisis: sigue listo (comportamiento de siempre, sin cambios)', async () => {
    mockRole = 'editor'
    mockAnalysis = { status: 'done', findings: { visual_summary: 'algo' } }
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hook="Gancho" hasVideo />)
    await waitFor(() => expect(screen.getByDisplayValue('hola')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /regenerar con ia/i })).not.toBeDisabled()
  })

  it('sin video, aunque haya análisis, sigue sin estar listo', () => {
    mockRole = 'editor'
    mockAnalysis = { status: 'done', findings: { visual_summary: 'algo' } }
    render(<IdeaCaptionEditor ideaId="i1" initialCaption={null} hasVideo={false} />)
    expect(screen.getByRole('button', { name: /generar desde el video/i })).toBeDisabled()
    expect(screen.getByText(/sube un video primero/i)).toBeInTheDocument()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })
})
