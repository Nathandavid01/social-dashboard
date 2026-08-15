import { describe, expect, it } from 'vitest'
import { captionJobsForPlatforms } from './caption-jobs'

describe('captionJobsForPlatforms', () => {
  it('returns one job per unique client network, with a focus line', () => {
    const jobs = captionJobsForPlatforms(['instagram', 'tiktok', 'instagram'])
    expect(jobs.map((j) => j.platform)).toEqual(['instagram', 'tiktok'])
    expect(jobs[0].focus.toLowerCase()).toMatch(/instagram|hook|hashtag/)
    expect(jobs[1].focus.toLowerCase()).toMatch(/tiktok|corto|oral/)
  })

  it('falls back to a single all-networks job when the client has none', () => {
    expect(captionJobsForPlatforms(null)).toEqual([
      { platform: 'all', focus: 'un solo caption que funcione en todas las redes' },
    ])
    expect(captionJobsForPlatforms(['', '  '])[0].platform).toBe('all')
  })
})
