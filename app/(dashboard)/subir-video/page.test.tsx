import { describe, it, expect, vi } from 'vitest'
import SubirVideoRedirectPage from './page'

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}))

describe('Subir video route', () => {
  it('redirige a /primer-round — no es la pantalla de Primer Round', () => {
    expect(() => SubirVideoRedirectPage()).toThrow('REDIRECT:/primer-round')
    expect(redirect).toHaveBeenCalledWith('/primer-round')
  })
})
