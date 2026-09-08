import {it,expect} from 'vitest'
import {clientDisplayName} from './client-display-name'
it('uses Title Case while preserving common acronyms',()=>{expect(clientDisplayName('casa plaza 6pm')).toBe('Casa Plaza 6PM');expect(clientDisplayName('CARDIOLOGY FAJARDO')).toBe('Cardiology Fajardo');expect(clientDisplayName('Neumaticos PR')).toBe('Neumaticos PR');expect(clientDisplayName('concentración del centro')).toBe('Concentración Del Centro')})
