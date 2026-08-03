import { DIAS, diaDeTablero, diaDePublicacion, etiquetaDia, offsetSemanaTablero, fechaEntregaDelDia, fechaDeEntrega, type DiaKey, type ModoDia } from './dias'

/**
 * La semana de un editor: qué le toca entregar cada día y cuándo se publica.
 *
 * Las pestañas de día contestan "qué hago hoy"; esto contesta "cómo viene la
 * semana", que es lo que hacía falta para planificar sin ir pestaña por
 * pestaña. Mismo criterio que el tablero —la columna es el día en que se
 * ENTREGA— para que las dos vistas no puedan discrepar.
 */

export interface IdeaParaSemana {
  publish_date: string | null
  client_id: string | null
  client?: { name: string } | null
}

export interface ClienteDelDia {
  id: string
  name: string
  videos: number
}

export interface DiaDeSemana {
  dia: DiaKey
  /** 'Lunes' — el día en que hay que entregar. */
  label: string
  /** 'Martes' — el día en que eso se publica. */
  diaPublicacion: string
  fechaEntrega: string
  fechaPublicacion: string
  clientes: ClienteDelDia[]
  total: number
}

export function semanaDeEntregas(
  ideas: IdeaParaSemana[],
  hoy: Date = new Date(),
  semana = 0,
  modo: ModoDia = 'entrega',
): DiaDeSemana[] {
  // Un mapa por día ANTES de recorrer las ideas: así un día sin trabajo sale
  // igualmente como columna vacía, en vez de desaparecer de la semana.
  const porDia = new Map<DiaKey, Map<string, ClienteDelDia>>()
  for (const d of DIAS) porDia.set(d.key, new Map())

  for (const i of ideas) {
    const dia = diaDeTablero(i.publish_date, modo)
    // Sin fecha no cae en ningún día: eso vive en la pestaña "Sin día".
    if (dia === null) continue
    // Solo la semana que se está mirando. Lo atrasado se acumula en la actual:
    // sigue pendiente, y esconderlo por vencido es lo contrario de lo que hace
    // falta.
    const w = offsetSemanaTablero(i.publish_date, modo, hoy)
    if (semana === 0 ? (w ?? 0) > 0 : w !== semana) continue
    const clientes = porDia.get(dia)
    if (!clientes) continue
    const id = i.client_id ?? 'sin-cliente'
    const prev = clientes.get(id)
    if (prev) prev.videos += 1
    else clientes.set(id, { id, name: i.client?.name ?? 'Sin cliente', videos: 1 })
  }

  return DIAS.map((d) => {
    const clientes = Array.from(porDia.get(d.key)?.values() ?? [])
      // Por nombre y no por volumen: se busca un cliente concreto, y una lista
      // que se reordena sola según el trabajo del día no se puede recorrer.
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return {
      dia: d.key,
      label: d.label,
      // En modo publicación la columna ya ES el día en que sale; lo útil
      // entonces es el día anterior, que es cuando hay que tenerlo listo.
      diaPublicacion: etiquetaDia(modo === 'publicacion' ? ((d.key + 6) % 7) as DiaKey : diaPublicacionDe(d.key)),
      fechaEntrega: fechaEntregaDelDia(d.key, hoy, semana),
      fechaPublicacion: fechaDeEntrega(d.key, hoy, semana),
      clientes,
      total: clientes.reduce((n, c) => n + c.videos, 0),
    }
  })
}

function diaPublicacionDe(dia: DiaKey): DiaKey {
  return diaDePublicacion(dia)
}
