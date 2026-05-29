import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaProgressBar } from './idea-progress-bar'
import type { IdeaProgress } from '@/lib/utils/idea-progress'

const progress: IdeaProgress = {
  stages: [],
  completed: 4,
  total: 7,
  percent: 57,
  missing: ['Caption', 'Editado'],
}

describe('IdeaProgressBar', () => {
  it('shows percent, count and what is missing', () => {
    render(<IdeaProgressBar progress={progress} />)
    expect(screen.getByText(/57%/)).toBeInTheDocument()
    expect(screen.getByText(/4\/7 etapas/)).toBeInTheDocument()
    expect(screen.getByText(/Caption/)).toBeInTheDocument()
    expect(screen.getByText(/Editado/)).toBeInTheDocument()
  })

  it('shows a done message when nothing is missing', () => {
    render(<IdeaProgressBar progress={{ ...progress, completed: 7, percent: 100, missing: [] }} />)
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.getByText(/completo/i)).toBeInTheDocument()
  })
})
