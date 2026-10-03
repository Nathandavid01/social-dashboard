import { describe, expect, it } from 'vitest'
import { reciboDeepLinkClientId } from './open-clients'

describe('reciboDeepLinkClientId', () => {
  it('sin params ni hash no abre a nadie', () => {
    expect(reciboDeepLinkClientId()).toBeNull()
    expect(reciboDeepLinkClientId({})).toBeNull()
    expect(reciboDeepLinkClientId({ cliente: '  ', hash: '#' })).toBeNull()
  })

  it('prioriza cliente, luego client, luego c, luego el hash', () => {
    expect(reciboDeepLinkClientId({ cliente: ' lab ', client: 'other', c: 'x', hash: '#hash' })).toBe('lab')
    expect(reciboDeepLinkClientId({ client: 'farm', c: 'x', hash: '#hash' })).toBe('farm')
    expect(reciboDeepLinkClientId({ c: ' yabu ', hash: '#hash' })).toBe('yabu')
    expect(reciboDeepLinkClientId({ hash: '#c2' })).toBe('c2')
    expect(reciboDeepLinkClientId({ hash: 'c2' })).toBe('c2')
  })
})
