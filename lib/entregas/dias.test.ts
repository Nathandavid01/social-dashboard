import { describe, it, expect } from 'vitest'
import { diaDeFecha, proximaFechaDelDia, etiquetaDia, DIAS, diaDePublicacion, diaDeEntrega, fechaDeEntrega, fechaEntregaDelDia, offsetSemana, rangoSemana } from './dias'

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
 * La pestaña es el día en que el editor ENTREGA; se publica al día siguiente.
 * Antes la pestaña era el día de publicación, y "Entregando para Lunes" en la
 * pestaña Lunes no decía cuándo se publicaba, sino cuándo se trabajaba.
 */
describe('diaDePublicacion', () => {
  it('entregar el lunes publica el martes', () => {
    expect(diaDePublicacion(1)).toBe(2)
  })

  it('cada día apunta al siguiente', () => {
    expect(diaDePublicacion(2)).toBe(3)
    expect(diaDePublicacion(3)).toBe(4)
    expect(diaDePublicacion(4)).toBe(5)
    expect(diaDePublicacion(5)).toBe(6)
  })

  // El domingo no existe en el tablero: entregar el sábado es para el lunes.
  it('el sábado publica el domingo, y el domingo el lunes', () => {
    expect(diaDePublicacion(6)).toBe(0)
    expect(diaDePublicacion(0)).toBe(1)
  })
})

describe('diaDeEntrega — la pestaña donde vive una tarjeta', () => {
  it('un video que publica el martes se entrega el lunes', () => {
    expect(diaDeEntrega('2026-08-04')).toBe(1) // martes -> lunes
  })

  it('un video que publica el lunes se entregó el domingo', () => {
    expect(diaDeEntrega('2026-08-03')).toBe(0) // lunes -> domingo
  })

  it('es exactamente la inversa de diaDePublicacion', () => {
    for (const d of DIAS) {
      const publica = diaDePublicacion(d.key)
      expect(diaDeEntrega(proximaFechaDelDia(publica))).toBe(d.key)
    }
  })

  it('un video que publica el domingo se entregó el sábado', () => {
    expect(diaDeEntrega('2026-08-02')).toBe(6) // domingo -> sábado
  })

  it('sin fecha no cae en ninguna pestaña', () => {
    expect(diaDeEntrega(null)).toBeNull()
    expect(diaDeEntrega('')).toBeNull()
  })
})

describe('fechaDeEntrega — qué fecha se guarda al entregar', () => {
  // Semanas naturales: la pestaña Lunes es el lunes DE ESA SEMANA, no "el
  // próximo lunes". Así los seis días pertenecen siempre al mismo rango.
  it('entregar en la pestaña Lunes guarda el martes de esa semana', () => {
    // jueves 2026-07-30 está en la semana del 27 jul: lunes 27 -> publica el 28
    expect(fechaDeEntrega(1, new Date(2026, 6, 30))).toBe('2026-07-28')
  })

  it('entregar en Sábado guarda el domingo', () => {
    // sábado 1 ago + 1 = domingo 2 ago
    expect(fechaDeEntrega(6, new Date(2026, 6, 30))).toBe('2026-08-02')
  })

  it('entregar en Domingo guarda el lunes siguiente', () => {
    // domingo 2 ago + 1 = lunes 3 ago
    expect(fechaDeEntrega(0, new Date(2026, 6, 30))).toBe('2026-08-03')
  })

  it('la fecha que guarda cae siempre en la pestaña desde la que se entregó', () => {
    for (const d of DIAS) {
      expect(diaDeEntrega(fechaDeEntrega(d.key, new Date(2026, 6, 30)))).toBe(d.key)
    }
  })
})

describe('fechaDeEntrega — la publicación nunca cae antes de la entrega', () => {
  // Calculando las dos fechas por separado, cada una redondeaba a su "próxima"
  // y podían invertirse: un jueves, la pestaña Miércoles daba el jueves de hoy.
  it('desde cualquier día de la semana, publicar va después de entregar', () => {
    for (let salto = 0; salto < 7; salto++) {
      const hoy = new Date(2026, 6, 27 + salto)
      for (const d of DIAS) {
        const entrega = fechaEntregaDelDia(d.key, hoy)
        const publica = fechaDeEntrega(d.key, hoy)
        expect(publica > entrega, `${d.label} desde ${hoy.toDateString()}`).toBe(true)
      }
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
    expect(fechaEntregaDelDia(1, JUEVES, 0)).toBe('2026-07-27')
  })

  it('una semana adelantado, el lunes siguiente', () => {
    expect(fechaEntregaDelDia(1, JUEVES, 1)).toBe('2026-08-03')
  })

  it('la publicación se adelanta con la entrega', () => {
    expect(fechaDeEntrega(1, JUEVES, 0)).toBe('2026-07-28')
    expect(fechaDeEntrega(1, JUEVES, 1)).toBe('2026-08-04')
  })

  it('publicar sigue cayendo después de entregar, también adelantado', () => {
    for (const semana of [0, 1, 2]) {
      for (const d of DIAS) {
        expect(fechaDeEntrega(d.key, JUEVES, semana) > fechaEntregaDelDia(d.key, JUEVES, semana)).toBe(true)
      }
    }
  })

  it('los siete días de una semana caen dentro de su rango', () => {
    const { desde, hasta } = rangoSemana(JUEVES, 1)
    expect(desde).toBe('2026-08-03')   // lunes
    expect(hasta).toBe('2026-08-09')   // domingo
    for (const d of DIAS) {
      const f = fechaEntregaDelDia(d.key, JUEVES, 1)
      expect(f >= desde && f <= hasta, d.label).toBe(true)
    }
  })
})

describe('offsetSemana — de qué semana es un video', () => {
  const JUEVES = new Date(2026, 6, 30)

  it('lo que se publica el martes 28 jul es de la semana en curso', () => {
    expect(offsetSemana('2026-07-28', JUEVES)).toBe(0)
  })

  it('lo que se publica el martes 4 ago es de la semana que viene', () => {
    expect(offsetSemana('2026-08-04', JUEVES)).toBe(1)
  })

  it('dos semanas adelante cuenta como 2', () => {
    expect(offsetSemana('2026-08-11', JUEVES)).toBe(2)
  })

  it('lo atrasado da negativo, para poder enseñarlo aparte', () => {
    expect(offsetSemana('2026-07-21', JUEVES)).toBeLessThan(0)
  })

  it('los siete días de una misma semana dan el mismo número', () => {
    const nums = DIAS.map((d) => offsetSemana(fechaDeEntrega(d.key, JUEVES, 1), JUEVES))
    expect(new Set(nums)).toEqual(new Set([1]))
  })

  it('sin fecha no pertenece a ninguna semana', () => {
    expect(offsetSemana(null, JUEVES)).toBeNull()
  })

  // Lo que se guarda al entregar tiene que volver a leerse en la misma semana.
  it('es la inversa de fechaDeEntrega', () => {
    for (const semana of [0, 1, 2]) {
      for (const d of DIAS) {
        expect(offsetSemana(fechaDeEntrega(d.key, JUEVES, semana), JUEVES)).toBe(semana)
      }
    }
  })
})

/**
 * El domingo pasó a ser día de entrega, así que la semana ya no salta ese día:
 * saltar escondería el trabajo del propio domingo, que es justo lo que la
 * pestaña nueva viene a enseñar.
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

  it('entregar el domingo publica el lunes siguiente', () => {
    expect(fechaEntregaDelDia(0, DOMINGO, 0)).toBe('2026-08-02')
    expect(fechaDeEntrega(0, DOMINGO, 0)).toBe('2026-08-03')
  })
})
