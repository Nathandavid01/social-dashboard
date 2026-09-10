// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildProposalPdf } from './proposal-pdf'
it('exporta todas las ideas con varias páginas, sin notas internas', () => {
  const ideas = Array.from({ length: 19 }, (_, n) => ({ id: `${n}`, title: `Idea ${n + 1}`, hook: 'Texto para el cliente. '.repeat(12), referenceUrl: null, shootingNotes: 'INTERNAL_SECRET' }))
  const pdf = buildProposalPdf('Miti Miti', '2026-09-10', ideas)
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
  const output = pdf.output()
  expect(output).toContain('Idea 19')
  expect(output).not.toContain('INTERNAL_SECRET')
})

it('incluye el objetivo que la idea busca lograr', () => {
  const pdf = buildProposalPdf('Miti Miti', '2026-09-10', [{
    id: 'goal', title: 'Promoción de temporada', objective: 'Aumentar reservas para septiembre',
    hook: '¿Ya tienes tu mesa?', referenceUrl: null,
  }])
  expect(pdf.output()).toContain('Aumentar reservas para septiembre')
})
