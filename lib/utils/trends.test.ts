import { describe, it, expect } from 'vitest'
import { parseTrendingRss, formatTrendsForPrompt, type TrendItem } from './trends'

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss">
<channel>
  <title>Daily Search Trends</title>
  <item>
    <title>Bad Bunny concierto</title>
    <ht:approx_traffic>50,000+</ht:approx_traffic>
  </item>
  <item>
    <title><![CDATA[Receta de mofongo & pernil]]></title>
    <ht:approx_traffic>20,000+</ht:approx_traffic>
  </item>
  <item>
    <title>Clima San Juan</title>
  </item>
</channel>
</rss>`

describe('parseTrendingRss', () => {
  it('extracts each item title and tags the source as google', () => {
    const trends = parseTrendingRss(SAMPLE)
    expect(trends).toHaveLength(3)
    expect(trends.map((t) => t.title)).toEqual([
      'Bad Bunny concierto',
      'Receta de mofongo & pernil',
      'Clima San Juan',
    ])
    expect(trends.every((t) => t.source === 'google')).toBe(true)
  })

  it('captures approximate traffic when present and leaves it undefined otherwise', () => {
    const trends = parseTrendingRss(SAMPLE)
    expect(trends[0].traffic).toBe('50,000+')
    expect(trends[2].traffic).toBeUndefined()
  })

  it('decodes CDATA and HTML entities in titles', () => {
    const trends = parseTrendingRss('<item><title>Caf&eacute; &amp; pan</title></item>')
    // &amp; decodes; unknown named entities are left as-is
    expect(trends[0].title).toBe('Caf&eacute; & pan')
  })

  it('returns an empty array for empty, malformed, or non-string input', () => {
    expect(parseTrendingRss('')).toEqual([])
    expect(parseTrendingRss('not xml at all')).toEqual([])
    // @ts-expect-error — guarding runtime misuse
    expect(parseTrendingRss(null)).toEqual([])
  })
})

describe('formatTrendsForPrompt', () => {
  it('renders one bullet per trend with traffic in parens when available', () => {
    const trends: TrendItem[] = [
      { title: 'Bad Bunny', traffic: '50,000+', source: 'google' },
      { title: 'Promo verano', source: 'manual' },
    ]
    expect(formatTrendsForPrompt(trends)).toBe('- Bad Bunny (50,000+)\n- Promo verano')
  })

  it('returns an empty string when there are no trends', () => {
    expect(formatTrendsForPrompt([])).toBe('')
  })
})
