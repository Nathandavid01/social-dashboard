import { expect, it } from 'vitest'
import { canAccessVideoInventory } from './video-inventory-access'
import { visibleNavItems } from '@/components/layout/nav-items'

const denisha = 'a16752e4-05d1-42e3-812c-28a1afb5752c'
const nathan = '165e5259-8f69-4ff4-b0f0-f790cba77b80'
it('allows only the verified Denisha Matos and Nathan Torres accounts', () => {
  expect(canAccessVideoInventory(denisha)).toBe(true)
  expect(canAccessVideoInventory(nathan)).toBe(true)
  for (const id of [null, undefined, '', '2ec6c260-4ed5-4c4b-8f85-8b76353532cb', '964999bf-29a3-4599-8776-7251f499b814']) expect(canAccessVideoInventory(id)).toBe(false)
})
it('shows the tab only to those identities, even when another owner has every permission', () => {
  for (const id of [denisha, nathan]) expect(visibleNavItems('owner', null, id).map((item) => item.href)).toContain('/inventario-videos')
  for (const id of [undefined, 'another-owner', '964999bf-29a3-4599-8776-7251f499b814']) expect(visibleNavItems('owner', null, id).map((item) => item.href)).not.toContain('/inventario-videos')
  expect(visibleNavItems('editor', ['/inventario-videos'], 'another-user').map((item) => item.href)).not.toContain('/inventario-videos')
  expect(visibleNavItems('owner', null, nathan, 'another-owner').map((item) => item.href)).not.toContain('/inventario-videos')
})
