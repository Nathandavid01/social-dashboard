import { describe, it, expect } from 'vitest'
import { buildIdeaVersionSnapshot } from './idea-version-snapshot'

describe('buildIdeaVersionSnapshot', () => {
  it('toma los campos de texto/estado previos', () => {
    const snap = buildIdeaVersionSnapshot({
      id: 'idea-1',
      title: 'Tour',
      hook: 'El dueño',
      visual_brief: 'Plano general',
      caption_angle: 'Humor',
      hashtags_suggestion: '#local',
      status: 'idea',
      content_type: 'R',
      shot_type: 'dji',
      reference_url: 'https://ex.com',
      rationale: 'por qué',
      shooting_notes: 'luz natural',
      extra: 'ignored',
    })
    expect(snap).toEqual({
      title: 'Tour',
      hook: 'El dueño',
      visual_brief: 'Plano general',
      caption_angle: 'Humor',
      hashtags_suggestion: '#local',
      status: 'idea',
      content_type: 'R',
      shot_type: 'dji',
      reference_url: 'https://ex.com',
      rationale: 'por qué',
      shooting_notes: 'luz natural',
    })
  })

  it('nullifica campos ausentes y rechaza filas vacías', () => {
    expect(buildIdeaVersionSnapshot(null)).toBeNull()
    expect(buildIdeaVersionSnapshot(undefined)).toBeNull()
    expect(buildIdeaVersionSnapshot({}).title).toBeNull()
    expect(buildIdeaVersionSnapshot({ title: 'X' }).hook).toBeNull()
  })
})
