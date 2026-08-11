import { DIAS, diaDeFecha, diaListo, etiquetaDia, offsetSemanaDeFecha, fechaDelDia, fechaAnterior, type DiaKey } from './dias'

/**
 * La semana de un editor: qué se publica cada día y cuándo hay que tenerlo.
 *
 * Las pestañas de día contestan "qué hago hoy"; esto contesta "cómo viene la
 * semana", que es lo que hacía falta para planificar sin ir pestaña por
 * pestaña. Mismo criterio que el tablero —la columna es el día en que se
 * PUBLICA— para que las dos vistas no puedan discrepar.
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
  /** 'Lunes' — el día en que se publica lo de esta columna. */
  label: string
  /** 'Domingo' — el día en que hay que tenerlo listo: el anterior. */
  diaListo: string
  /** La fecha en que hay que tenerlo listo: el día antes de publicar. */
  fechaListo: string
  /** La fecha en que se publica: la de la propia columna. */
  fechaPublicacion: string
  clientes: ClienteDelDia[]
  total: number
}

export function semanaDeEntregas(
  ideas: IdeaParaSemana[],
  hoy: Date = new Date(),
  semana = 0,
): DiaDeSemana[] {
  // Un mapa por día ANTES de recorrer las ideas: así un día sin trabajo sale
  // igualmente como columna vacía, en vez de desaparecer de la semana.
  const porDia = new Map<DiaKey, Map<string, ClienteDelDia>>()
  for (const d of DIAS) porDia.set(d.key, new Map())

  for (const i of ideas) {
    const dia = diaDeFecha(i.publish_date)
    // Sin fecha no cae en ningún día: eso vive en la pestaña "Sin día".
    if (dia === null) continue
    // Solo la semana que se está mirando. Lo atrasado se acumula en la actual:
    // sigue pendiente, y esconderlo por vencido es lo contrario de lo que hace
    // falta.
    const w = offsetSemanaDeFecha(i.publish_date, hoy)
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
      // La columna ES el día en que sale; lo útil es el día anterior, que es
      // cuando hay que tenerlo listo.
      diaListo: etiquetaDia(diaListo(d.key)),
      fechaListo: fechaAnterior(fechaDelDia(d.key, hoy, semana)),
      fechaPublicacion: fechaDelDia(d.key, hoy, semana),
      clientes,
      total: clientes.reduce((n, c) => n + c.videos, 0),
    }
  })
}
