import { describe, it, expect } from 'vitest'
import { diaDeFecha, proximaFechaDelDia, etiquetaDia, DIAS, diaListo, fechaDelDia, offsetSemanaDeFecha, rangoSemana } from './dias'

describe('DIAS', () => {
  it('va de lunes a domingo', () => {
    expect(DIAS.map((d) => d.label)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  })
})

describe('diaDeFecha', () => {
  // 2026-07-27 es lunes.
  it('saca el día de la semana de una fecha', () => {
    expect(diaDeFecha('2026-07-27')).toBe(1) // lunes
    expect(diaDeFecha('2026-07-28')).toBe(2) // martes
    expect(diaDeFecha('2026-08-01')).toBe(6) // sábado
  })

  it('el domingo también es un día de la operación', () => {
    // Había 3 videos con fecha en domingo y 3 clientes con el domingo en su
    // cadencia: dejarlo fuera los mandaba a "Sin día" como si no tuvieran fecha.
    expect(diaDeFecha('2026-08-02')).toBe(0)
  })

  it('sin fecha no hay día', () => {
    expect(diaDeFecha(null)).toBeNull()
    expect(diaDeFecha(undefined)).toBeNull()
    expect(diaDeFecha('')).toBeNull()
  })

  it('una fecha malformada no revienta', () => {
    expect(diaDeFecha('no-es-fecha')).toBeNull()
  })
})

describe('proximaFechaDelDia', () => {
  const lunes = new Date(2026, 6, 27, 10) // lunes 27 jul 2026

  it('entregar para hoy significa HOY, no la semana que viene', () => {
    expect(proximaFechaDelDia(1, lunes)).toBe('2026-07-27')
  })

  it('un día posterior de la misma semana', () => {
    expect(proximaFechaDelDia(3, lunes)).toBe('2026-07-29') // miércoles
    expect(proximaFechaDelDia(6, lunes)).toBe('2026-08-01') // sábado
  })

  it('un día ya pasado salta a la semana siguiente', () => {
    const jueves = new Date(2026, 6, 30, 10)
    expect(proximaFechaDelDia(1, jueves)).toBe('2026-08-03') // el lunes que viene
  })

  it('cruza de mes sin romperse', () => {
    const viernes = new Date(2026, 6, 31, 10) // 31 jul
    expect(proximaFechaDelDia(6, viernes)).toBe('2026-08-01')
  })

  it('lo que devuelve vuelve a leerse como el mismo día', () => {
    for (const d of DIAS) {
      expect(diaDeFecha(proximaFechaDelDia(d.key, lunes))).toBe(d.key)
    }
  })
})

describe('etiquetaDia', () => {
  it('nombra el día, y lo vacío es "Sin día"', () => {
    expect(etiquetaDia(1)).toBe('Lunes')
    expect(etiquetaDia(null)).toBe('Sin día')
  })
})

/**
 * REGRESIÓN — la pestaña es el día en que el video SE PUBLICA.
 *
 * Antes /revision colocaba cada tarjeta un día antes de su publish_date (la
 * pestaña era el día de entrega) y /entregas la colocaba en su fecha real. El
 * mismo video salía en pestañas distintas según la pantalla, y el equipo lo
 * reportó como que los videos se cruzaban. Ahora manda la fecha que eligió el
 * editor, sin traducirla: es la única que existe.
 */
describe('la pestaña de una tarjeta es el día de su publish_date', () => {
  it('un video que publica el miércoles vive en el miércoles', () => {
    expect(diaDeFecha('2026-08-05')).toBe(3)
  })

  it('un video que publica el lunes vive en el lunes, no en el domingo anterior', () => {
    expect(diaDeFecha('2026-08-03')).toBe(1)
  })

  // La cadencia de La Guira es publicar lunes, miércoles y viernes: tiene que
  // verse en esos días y no un día antes.
  it('una cadencia lunes-miércoles-viernes se ve tal cual', () => {
    expect(['2026-08-03', '2026-08-05', '2026-08-07'].map((f) => diaDeFecha(f))).toEqual([1, 3, 5])
  })
})

/** El día en que el video tiene que estar LISTO: el anterior al que publica. */
describe('diaListo', () => {
  it('lo que publica el martes hay que tenerlo el lunes', () => {
    expect(diaListo(2)).toBe(1)
  })

  it('cada día apunta al anterior', () => {
    expect(diaListo(3)).toBe(2)
    expect(diaListo(6)).toBe(5)
  })

  it('lo que publica el lunes hay que tenerlo el domingo', () => {
    expect(diaListo(1)).toBe(0)
  })

  it('lo que publica el domingo hay que tenerlo el sábado', () => {
    expect(diaListo(0)).toBe(6)
  })
})

describe('fechaDelDia — la fecha de publicación de una columna', () => {
  // Semanas naturales: la pestaña Lunes es el lunes DE ESA SEMANA, no "el
  // próximo lunes". Así los siete días pertenecen siempre al mismo rango.
  it('la pestaña Lunes es el lunes de esa semana', () => {
    // jueves 2026-07-30 está en la semana del 27 jul
    expect(fechaDelDia(1, new Date(2026, 6, 30))).toBe('2026-07-27')
  })

  it('la pestaña Sábado es el sábado de esa semana', () => {
    expect(fechaDelDia(6, new Date(2026, 6, 30))).toBe('2026-08-01')
  })

  it('el domingo cierra la semana: es el día siguiente al sábado', () => {
    expect(fechaDelDia(0, new Date(2026, 6, 30))).toBe('2026-08-02')
  })

  it('la fecha de una columna vuelve a leerse en esa misma columna', () => {
    for (const d of DIAS) {
      expect(diaDeFecha(fechaDelDia(d.key, new Date(2026, 6, 30)))).toBe(d.key)
    }
  })
})

/**
 * El editor que va adelantado entrega para la semana que viene. Las pestañas
 * solo distinguen el día, así que sin esto dos martes distintos caían en la
 * misma pestaña, mezclados y sin forma de saber cuál era de cuándo.
 */
describe('semanas adelantadas', () => {
  const JUEVES = new Date(2026, 6, 30) // 2026-07-30

  it('sin adelanto, el lunes es el de la semana en curso', () => {
    expect(fechaDelDia(1, JUEVES, 0)).toBe('2026-07-27')
  })

  it('una semana adelantado, el lunes siguiente', () => {
    expect(fechaDelDia(1, JUEVES, 1)).toBe('2026-08-03')
  })

  it('los siete días de una semana caen dentro de su rango', () => {
    const { desde, hasta } = rangoSemana(JUEVES, 1)
    expect(desde).toBe('2026-08-03')   // lunes
    expect(hasta).toBe('2026-08-09')   // domingo
    for (const d of DIAS) {
      const f = fechaDelDia(d.key, JUEVES, 1)
      expect(f >= desde && f <= hasta, d.label).toBe(true)
    }
  })
})

describe('offsetSemanaDeFecha — de qué semana es un video', () => {
  const JUEVES = new Date(2026, 6, 30)

  it('lo que se publica el martes 28 jul es de la semana en curso', () => {
    expect(offsetSemanaDeFecha('2026-07-28', JUEVES)).toBe(0)
  })

  it('lo que se publica el martes 4 ago es de la semana que viene', () => {
    expect(offsetSemanaDeFecha('2026-08-04', JUEVES)).toBe(1)
  })

  it('dos semanas adelante cuenta como 2', () => {
    expect(offsetSemanaDeFecha('2026-08-11', JUEVES)).toBe(2)
  })

  it('lo atrasado da negativo, para poder enseñarlo aparte', () => {
    expect(offsetSemanaDeFecha('2026-07-21', JUEVES)).toBeLessThan(0)
  })

  it('los siete días de una misma semana dan el mismo número', () => {
    const nums = DIAS.map((d) => offsetSemanaDeFecha(fechaDelDia(d.key, JUEVES, 1), JUEVES))
    expect(new Set(nums)).toEqual(new Set([1]))
  })

  it('sin fecha no pertenece a ninguna semana', () => {
    expect(offsetSemanaDeFecha(null, JUEVES)).toBeNull()
  })

  // REGRESIÓN: publicar el lunes 3 caía en la semana ANTERIOR cuando la semana
  // se contaba por el día de entrega (domingo 2). Un video de lunes desaparecía
  // de su propia semana.
  it('el lunes pertenece a su semana, no a la anterior', () => {
    const LUNES = new Date(2026, 7, 3)
    expect(offsetSemanaDeFecha('2026-08-03', LUNES)).toBe(0)
  })

  it('es la inversa de fechaDelDia', () => {
    for (const semana of [0, 1, 2]) {
      for (const d of DIAS) {
        expect(offsetSemanaDeFecha(fechaDelDia(d.key, JUEVES, semana), JUEVES)).toBe(semana)
      }
    }
  })
})

/**
 * El domingo pasó a ser día de la operación, así que la semana ya no salta ese
 * día: saltarlo escondería el trabajo del propio domingo.
 */
describe('el domingo cierra su semana, no abre la siguiente', () => {
  const DOMINGO = new Date(2026, 7, 2)  // domingo 2026-08-02
  const SABADO = new Date(2026, 7, 1)   // sábado  2026-08-01

  it('sábado y domingo están en la misma semana', () => {
    expect(rangoSemana(SABADO, 0)).toEqual(rangoSemana(DOMINGO, 0))
  })

  it('esa semana va del lunes 27 al domingo 2', () => {
    expect(rangoSemana(DOMINGO, 0)).toEqual({ desde: '2026-07-27', hasta: '2026-08-02' })
  })

  it('el lunes ya abre la suya', () => {
    expect(rangoSemana(new Date(2026, 7, 3), 0)).toEqual({ desde: '2026-08-03', hasta: '2026-08-09' })
  })
})
