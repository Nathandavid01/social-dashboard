import { describe, it, expect } from 'vitest'
import { diffImportableBrands } from './metricool-import-core'

describe('diffImportableBrands', () => {
  const brands = [
    { id: '101', name: 'Dr. Loyola' },
    { id: '102', name: 'Casita Vieja' }, // already a client by name
    { id: '103', name: 'Neumáticos PR' },
    { id: '104', name: 'Blend Salón' }, // already linked by blog id
  ]
  const clients = [
    { name: 'Casita Vieja', metricool_blog_id: null },
    { name: 'Some Client', metricool_blog_id: '104' },
  ]

  it('returns only brands not yet linked by id or matching a client name', () => {
    const out = diffImportableBrands(brands, clients)
    expect(out.map((b) => b.name)).toEqual(['Dr. Loyola', 'Neumáticos PR'])
  })

  it('excludes a brand already linked by metricool blog id', () => {
    expect(diffImportableBrands([{ id: '104', name: 'Blend Salón' }], clients)).toEqual([])
  })

  it('excludes a brand whose name already exists as a client (case-insensitive)', () => {
    expect(diffImportableBrands([{ id: '999', name: 'casita VIEJA' }], clients)).toEqual([])
  })

  it('de-duplicates brands by id and drops blank ones', () => {
    const out = diffImportableBrands(
      [{ id: '1', name: 'A' }, { id: '1', name: 'A dup' }, { id: '', name: 'blank' }, { id: '2', name: '   ' }],
      [],
    )
    expect(out.map((b) => b.id)).toEqual(['1'])
  })

  it('sorts results by name', () => {
    const out = diffImportableBrands([{ id: '1', name: 'Zeta' }, { id: '2', name: 'Alfa' }], [])
    expect(out.map((b) => b.name)).toEqual(['Alfa', 'Zeta'])
  })

  it('matches names loosely (& vs and, accents, punctuation) to avoid duplicates', () => {
    const existing = [{ name: 'Beyond PVC Cabinets and Closets', metricool_blog_id: null }, { name: 'La Güira', metricool_blog_id: null }]
    const out = diffImportableBrands(
      [
        { id: '1', name: 'Beyond PVC Cabinets & Closets' }, // & ~ and → existing
        { id: '2', name: 'La Guira' }, // accent → existing
        { id: '3', name: 'Brand Nuevo' }, // genuinely new
      ],
      existing,
    )
    expect(out.map((b) => b.name)).toEqual(['Brand Nuevo'])
  })
})
