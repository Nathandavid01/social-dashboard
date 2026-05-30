/**
 * WorkflowStats — the stat chips on the Workflow board toolbar
 * (Ideas / Pendientes / En flujo / Publicadas).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WorkflowStats } from './workflow-stats'

beforeEach(cleanup)

describe('WorkflowStats', () => {
  it('renders each metric value with its label', () => {
    render(<WorkflowStats total={6} pendientes={4} enFlujo={1} publicadas={0} />)
    for (const label of ['Ideas', 'Pendientes', 'En flujo', 'Publicadas']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
