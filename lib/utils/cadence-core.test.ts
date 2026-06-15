import { describe, it, expect } from 'vitest'
import { cycleCadence, schedulesToDayMap, dayMapToSchedules, countCadence } from './cadence-core'

describe('cycleCadence', () => {
  it('cycles empty → R → P → empty', () => {
    expect(cycleCadence(null)).toBe('R')
    expect(cycleCadence('R')).toBe('P')
    expect(cycleCadence('P')).toBeNull()
  })
})

describe('schedulesToDayMap', () => {
  it('maps day_of_week to content_type', () => {
    expect(schedulesToDayMap([
      { day_of_week: 1, content_type: 'R' },
      { day_of_week: 2, content_type: 'P' },
    ])).toEqual({ 1: 'R', 2: 'P' })
  })

  it('keeps the first type when a day has duplicates', () => {
    expect(schedulesToDayMap([
      { day_of_week: 3, content_type: 'R' },
      { day_of_week: 3, content_type: 'P' },
    ])).toEqual({ 3: 'R' })
  })
})

describe('dayMapToSchedules', () => {
  it('drops empty days and orders Mon→Sun', () => {
    expect(dayMapToSchedules({ 5: 'R', 1: 'P', 3: null })).toEqual([
      { day_of_week: 1, content_type: 'P' },
      { day_of_week: 5, content_type: 'R' },
    ])
  })

  it('returns an empty array when nothing is set', () => {
    expect(dayMapToSchedules({})).toEqual([])
  })
})

describe('countCadence', () => {
  it('counts reels, posts and total', () => {
    expect(countCadence({ 1: 'R', 2: 'P', 3: 'R', 4: null })).toEqual({ total: 3, reels: 2, posts: 1 })
  })
})
