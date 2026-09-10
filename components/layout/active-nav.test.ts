import {describe,it,expect} from 'vitest'
import {activeNavHref} from './active-nav'
describe('single navigation selection',()=>{
 const links=['/home','/clients','/clients/asignaciones','/settings','/settings/users']
 it('selects only assignments instead of both clients and assignments',()=>expect(activeNavHref('/clients/asignaciones',links)).toBe('/clients/asignaciones'))
 it('keeps client details under clients',()=>expect(activeNavHref('/clients/abc',links)).toBe('/clients'))
 it('prefers the most specific parent for nested pages',()=>expect(activeNavHref('/settings/users/abc',links)).toBe('/settings/users'))
 it('does not match unrelated route prefixes',()=>expect(activeNavHref('/clients-other',links)).toBeNull())
 it('falls back to the visible parent if child is hidden',()=>expect(activeNavHref('/clients/asignaciones',['/clients'])).toBe('/clients'))
})
