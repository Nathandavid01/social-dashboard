import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InternalReviewPanel, type ReviewVideo } from './internal-review-panel'

function video(over: Partial<ReviewVideo> = {}): ReviewVideo {
  return {
    id: 'v1',
    title: 'Rutina de piernas',
    clientName: 'Nora Fitness',
    editedUrl: 'https://cdn.example.com/v1.mp4',
    approval_status: 'submitted',
    submitted_by: 'editor-1',
    submittedByName: 'Ana',
    ...over,
  }
}

const onDecision = vi.fn()
beforeEach(() => onDecision.mockReset())

function renderPanel(over: Partial<ReviewVideo> = {}, role: 'supervisor' | 'editor' = 'supervisor') {
  return render(
    <InternalReviewPanel video={video(over)} role={role} userId="sup-1" onDecision={onDecision} />,
  )
}

describe('InternalReviewPanel — the reviewer watches and decides', () => {
  it('shows the video, its title and who sent it', () => {
    const { container } = renderPanel()
    expect(screen.getByText('Rutina de piernas')).toBeInTheDocument()
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn.example.com/v1.mp4')
  })

  it('a reviewer gets both decisions', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /pedir cambios/i })).toBeEnabled()
  })

  it('approving reports the decision', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    expect(onDecision).toHaveBeenCalledWith('approve', '')
  })

  it('sending it back requires a note saying what to change', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /pedir cambios/i }))
    // The note box opens; nothing is reported until there is a reason.
    expect(onDecision).not.toHaveBeenCalled()
    const box = screen.getByPlaceholderText(/qué hay que cambiar/i)
    fireEvent.change(box, { target: { value: 'Corta los primeros 2s' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar al editor/i }))
    expect(onDecision).toHaveBeenCalledWith('request_changes', 'Corta los primeros 2s')
  })

  it('an editor sees the state but cannot decide', () => {
    renderPanel({}, 'editor')
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/En revisión/)).toBeInTheDocument()
  })

  it('nobody reviews their own video', () => {
    renderPanel({ submitted_by: 'sup-1' })
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no puedes revisar tu propio video/i)).toBeInTheDocument()
  })

  it('an already-approved video shows no decisions', () => {
    renderPanel({ approval_status: 'approved' })
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
  })

  it('a video sent back shows the changes asked for', () => {
    renderPanel({ approval_status: 'revision_needed', reviewNote: 'Corta los primeros 2s' })
    expect(screen.getByText('Cambios pedidos')).toBeInTheDocument()
    expect(screen.getByText(/Corta los primeros 2s/)).toBeInTheDocument()
  })
})
