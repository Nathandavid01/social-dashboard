import { describe, expect, it } from 'vitest'
import { proxiedClientLogo } from './client-logo-url'

describe('proxiedClientLogo', () => {
  const pics = { '42': 'https://static.metricool.com/a.png' }
  it('an uploaded logo wins, routed through the same-origin proxy', () => {
    expect(proxiedClientLogo({ logo_url: 'https://x.supabase.co/l.png', metricool_blog_id: 42 }, pics)).toBe(
      '/api/img-proxy?u=' + encodeURIComponent('https://x.supabase.co/l.png'),
    )
  })
  it('falls back to the Metricool picture, then to null', () => {
    expect(proxiedClientLogo({ logo_url: null, metricool_blog_id: '42' }, pics)).toContain(encodeURIComponent('static.metricool.com'))
    expect(proxiedClientLogo({ logo_url: '  ', metricool_blog_id: 7 }, pics)).toBeNull()
  })
})
