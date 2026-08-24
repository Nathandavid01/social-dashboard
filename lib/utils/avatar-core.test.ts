import { describe, it, expect } from 'vitest'
import {
  dicebearUrl,
  isAllowedAvatarUrl,
  avatarSeeds,
  initialsFrom,
  AVATAR_STYLES,
  hasRealAvatar,
  canUpdateOwnAvatar,
  shouldPromptForAvatar,
} from './avatar-core'

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

  it('hasRealAvatar is false for empty, initials generators, and placeholders', () => {
    expect(hasRealAvatar(null)).toBe(false)
    expect(hasRealAvatar(undefined)).toBe(false)
    expect(hasRealAvatar('')).toBe(false)
    expect(hasRealAvatar('   ')).toBe(false)
    expect(hasRealAvatar('https://api.dicebear.com/9.x/initials/svg?seed=Jeand')).toBe(false)
    expect(hasRealAvatar('https://ui-avatars.com/api/?name=Jeand')).toBe(false)
    expect(hasRealAvatar('https://www.gravatar.com/avatar/000?d=mp')).toBe(false)
  })

  it('hasRealAvatar is true for an uploaded storage photo or a chosen non-initials avatar', () => {
    expect(
      hasRealAvatar(
        'https://xxxx.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg?v=1',
      ),
    ).toBe(true)
    expect(hasRealAvatar('https://api.dicebear.com/9.x/notionists/svg?seed=Jeand')).toBe(true)
  })

  it('only the signed-in user can update their own avatar', () => {
    expect(canUpdateOwnAvatar(null, 'u1')).toBe(false)
    expect(canUpdateOwnAvatar('u1', 'u2')).toBe(false)
    expect(canUpdateOwnAvatar('u1', 'u1')).toBe(true)
  })

  it('prompts until there is a real avatar; session postpone hides it once', () => {
    expect(shouldPromptForAvatar(null, false)).toBe(true)
    expect(shouldPromptForAvatar('https://api.dicebear.com/9.x/initials/svg?seed=J', false)).toBe(true)
    expect(shouldPromptForAvatar(null, true)).toBe(false)
    expect(
      shouldPromptForAvatar(
        'https://xxxx.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg',
        false,
      ),
    ).toBe(false)
  })
})
