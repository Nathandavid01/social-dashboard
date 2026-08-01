import { describe, it, expect } from 'vitest'
import { semanaDeEntregas, type IdeaParaSemana } from './semana'

// jueves 2026-07-30
const HOY = new Date(2026, 6, 30)

const idea = (over: Partial<IdeaParaSemana> = {}): IdeaParaSemana => ({
  publish_date: '2026-07-28', // martes de la semana en curso -> se entrega el lunes
  client_id: 'c1',
  client: { name: 'Kavanna' },
  ...over,
})

describe('semanaDeEntregas', () => {
  it('trae los siete días de entrega, de lunes a domingo', () => {
    const s = semanaDeEntregas([], HOY)
    expect(s).toHaveLength(7)
    expect(s.map((d) => d.label)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  })

  it('cada día dice cuándo se publica lo que entregas ese día', () => {
    const s = semanaDeEntregas([], HOY)
    expect(s[0].diaPublicacion).toBe('Martes')
    expect(s[5].diaPublicacion).toBe('Domingo') // sábado -> domingo
    expect(s[6].diaPublicacion).toBe('Lunes')   // domingo cierra la semana
  })

  it('coloca el video en el día en que hay que entregarlo, no en el que se publica', () => {
    const s = semanaDeEntregas([idea({ publish_date: '2026-07-28' })], HOY) // martes
    expect(s[0].total).toBe(1)   // lunes
    expect(s[1].total).toBe(0)
  })

  it('agrupa por cliente y cuenta sus videos', () => {
    const s = semanaDeEntregas([idea(), idea(), idea({ client_id: 'c2', client: { name: 'Barber' } })], HOY)
    expect(s[0].clientes).toEqual([
      { id: 'c2', name: 'Barber', videos: 1 },
      { id: 'c1', name: 'Kavanna', videos: 2 },
    ])
    expect(s[0].total).toBe(3)
  })

  it('ordena los clientes por nombre, no por cuántos videos traen', () => {
    const s = semanaDeEntregas([
      idea({ client_id: 'z', client: { name: 'Zeta' } }),
      idea({ client_id: 'a', client: { name: 'Alfa' } }),
    ], HOY)
    expect(s[0].clientes.map((c) => c.name)).toEqual(['Alfa', 'Zeta'])
  })

  it('un video sin fecha no cae en ningún día — tiene su propia pestaña', () => {
    const s = semanaDeEntregas([idea({ publish_date: null })], HOY)
    expect(s.every((d) => d.total === 0)).toBe(true)
  })

  it('la fecha de entrega de cada día es la próxima de ese día', () => {
    const s = semanaDeEntregas([], HOY)
    // jueves 30 jul está en la semana del lunes 27
    expect(s[0].fechaEntrega).toBe('2026-07-27')
    expect(s[0].fechaPublicacion).toBe('2026-07-28')
  })

  it('la fecha de publicación es siempre la del día siguiente al de entrega', () => {
    for (const d of semanaDeEntregas([], HOY)) {
      expect(d.fechaPublicacion > d.fechaEntrega).toBe(true)
    }
  })

  it('un cliente sin nombre no rompe la columna', () => {
    const s = semanaDeEntregas([idea({ client: null })], HOY)
    expect(s[0].clientes[0].name).toBe('Sin cliente')
  })
})
