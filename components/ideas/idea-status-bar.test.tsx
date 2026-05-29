import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaStatusBar } from './idea-status-bar'
import type { IdeaPipeline } from '@/lib/utils/idea-pipeline-stages'

const pipeline: IdeaPipeline = {
  stages: [
    { key: 'idea', label: 'Idea', done: true },
    { key: 'caption', label: 'Caption', done: true },
    { key: 'scheduled', label: 'Agendada', done: false },
    { key: 'recorded', label: 'Grabación', done: false },
    { key: 'edited', label: 'Edición', done: false },
    { key: 'approval', label: 'Aprobación', done: false },
    { key: 'published', label: 'Publicado', done: false },
  ],
  currentIndex: 2,
  completed: 2,
  percent: 29,
}

describe('IdeaStatusBar', () => {
  it('renders a segment per stage and names the current stage', () => {
    render(<IdeaStatusBar pipeline={pipeline} />)
    expect(screen.getAllByTestId('stage-segment')).toHaveLength(7)
    expect(screen.getByText('Agendada')).toBeInTheDocument()
    expect(screen.getByText(/2\/7/)).toBeInTheDocument()
  })

  it('shows "Completado" when all stages are done', () => {
    const done: IdeaPipeline = {
      stages: pipeline.stages.map((s) => ({ ...s, done: true })),
      currentIndex: 7,
      completed: 7,
      percent: 100,
    }
    render(<IdeaStatusBar pipeline={done} />)
    expect(screen.getByText('Completado')).toBeInTheDocument()
  })
})
