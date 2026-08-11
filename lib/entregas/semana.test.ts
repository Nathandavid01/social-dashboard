import { describe, it, expect } from 'vitest'
import { semanaDeEntregas, type IdeaParaSemana } from './semana'

// jueves 2026-07-30
const HOY = new Date(2026, 6, 30)

const idea = (over: Partial<IdeaParaSemana> = {}): IdeaParaSemana => ({
  publish_date: '2026-07-28', // martes de la semana en curso
  client_id: 'c1',
  client: { name: 'Kavanna' },
  ...over,
})

describe('semanaDeEntregas', () => {
  it('trae los siete días, de lunes a domingo', () => {
    const s = semanaDeEntregas([], HOY)
    expect(s).toHaveLength(7)
    expect(s.map((d) => d.label)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  })

  it('cada día dice cuándo hay que tener listo lo que sale ese día', () => {
    const s = semanaDeEntregas([], HOY)
    expect(s[0].diaListo).toBe('Domingo') // lo del lunes, listo el domingo
    expect(s[1].diaListo).toBe('Lunes')
    expect(s[6].diaListo).toBe('Sábado')  // lo del domingo, listo el sábado
  })

  /**
   * REGRESIÓN — la columna es el día en que el video SE PUBLICA.
   *
   * Se colocaba un día antes (la columna era el día de entrega) mientras
   * /entregas usaba la fecha real, y el mismo video salía en días distintos
   * según la pantalla.
   */
  it('coloca el video en el día de su publish_date, no un día antes', () => {
    const s = semanaDeEntregas([idea({ publish_date: '2026-07-28' })], HOY) // martes
    expect(s[1].total).toBe(1)   // martes
    expect(s[0].total).toBe(0)   // lunes
  })

  it('un video de lunes cae en el lunes, no en el domingo anterior', () => {
    const s = semanaDeEntregas([idea({ publish_date: '2026-07-27' })], HOY)
    expect(s[0].total).toBe(1)
    expect(s[6].total).toBe(0)
  })

  it('agrupa por cliente y cuenta sus videos', () => {
    const s = semanaDeEntregas([idea(), idea(), idea({ client_id: 'c2', client: { name: 'Barber' } })], HOY)
    expect(s[1].clientes).toEqual([
      { id: 'c2', name: 'Barber', videos: 1 },
      { id: 'c1', name: 'Kavanna', videos: 2 },
    ])
    expect(s[1].total).toBe(3)
  })

  it('ordena los clientes por nombre, no por cuántos videos traen', () => {
    const s = semanaDeEntregas([
      idea({ client_id: 'z', client: { name: 'Zeta' } }),
      idea({ client_id: 'a', client: { name: 'Alfa' } }),
    ], HOY)
    expect(s[1].clientes.map((c) => c.name)).toEqual(['Alfa', 'Zeta'])
  })

  it('un video sin fecha no cae en ningún día — tiene su propia pestaña', () => {
    const s = semanaDeEntregas([idea({ publish_date: null })], HOY)
    expect(s.every((d) => d.total === 0)).toBe(true)
  })

  it('la fecha de publicación de cada día es la de esa columna', () => {
    const s = semanaDeEntregas([], HOY)
    // jueves 30 jul está en la semana del lunes 27
    expect(s[0].fechaPublicacion).toBe('2026-07-27')
    expect(s[1].fechaPublicacion).toBe('2026-07-28')
  })

  it('la fecha de listo es siempre el día ANTES de publicar', () => {
    for (const d of semanaDeEntregas([], HOY)) {
      expect(d.fechaListo < d.fechaPublicacion, d.label).toBe(true)
    }
  })

  // REGRESIÓN: buscar el "listo" del lunes por día de la semana lo mandaba al
  // domingo del final de esa misma semana — seis días TARDE, no uno antes.
  it('el listo del lunes es el domingo anterior, no el del final de la semana', () => {
    const s = semanaDeEntregas([], HOY)
    expect(s[0].fechaPublicacion).toBe('2026-07-27')
    expect(s[0].fechaListo).toBe('2026-07-26')
  })

  it('un cliente sin nombre no rompe la columna', () => {
    const s = semanaDeEntregas([idea({ client: null })], HOY)
    expect(s[1].clientes[0].name).toBe('Sin cliente')
  })
})
