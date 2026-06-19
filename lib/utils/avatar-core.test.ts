import { describe, it, expect } from 'vitest'
import { dicebearUrl, isAllowedAvatarUrl, avatarSeeds, initialsFrom, AVATAR_STYLES } from './avatar-core'

describe('avatar-core', () => {
  it('builds a dicebear svg url and encodes the seed', () => {
    expect(dicebearUrl('notionists', 'Ana Lopez')).toBe(
      'https://api.dicebear.com/9.x/notionists/svg?seed=Ana%20Lopez',
    )
  })

  it('falls back to the first style for an unknown style', () => {
    expect(dicebearUrl('hacker', 'x')).toContain(`/${AVATAR_STYLES[0].id}/`)
  })

  it('only allows https dicebear urls', () => {
    expect(isAllowedAvatarUrl('https://api.dicebear.com/9.x/thumbs/svg?seed=x')).toBe(true)
    expect(isAllowedAvatarUrl('http://api.dicebear.com/x')).toBe(false)
    expect(isAllowedAvatarUrl('https://evil.com/x.svg')).toBe(false)
    expect(isAllowedAvatarUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedAvatarUrl('not a url')).toBe(false)
  })

  it('builds starter seeds from the base + index', () => {
    expect(avatarSeeds('Ana', 3)).toEqual(['Ana', 'Ana-1', 'Ana-2'])
    expect(avatarSeeds('  ', 1)).toEqual(['nate'])
  })

  it('derives initials from name then email', () => {
    expect(initialsFrom('Ana Lopez')).toBe('AL')
    expect(initialsFrom('Cher')).toBe('CH')
    expect(initialsFrom('', 'bob@x.com')).toBe('B')
    expect(initialsFrom(null, null)).toBe('U')
  })
})
