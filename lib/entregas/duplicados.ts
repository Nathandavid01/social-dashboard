/**
 * El mismo archivo editado, registrado como varios videos.
 *
 * Cada envío crea una fila NUEVA en content_ideas: no existe un camino de
 * "reemplazar el video de esta tarjeta". Así que resubir el mismo corte después
 * de un "cambios pedidos", o un doble clic en Enviar, deja el mismo archivo dos
 * veces en el tablero — y cada copia con su propia fecha.
 *
 * En la base de datos había 9 grupos así, varios con fechas DISTINTAS: el mismo
 * video anunciado para dos días. Es un cruce real y nada lo señalaba, porque
 * cada tarjeta por separado es perfectamente coherente.
 *
 * Esto no borra ni fusiona nada: elegir cuál de las dos fechas es la buena es
 * una decisión de la persona que lo subió. Lo único que hace falta es que se
 * vea.
 */

export interface ArchivoDeIdea {
  id: string
  name: string | null
  size_bytes: number | null
  kind: string | null
  storage_provider: string | null
  uploaded_at?: string | null
}

export interface IdeaConArchivos {
  id: string
  client_id: string | null
  status?: string | null
  publish_date: string | null
  videos: ArchivoDeIdea[]
}

export interface Repetido {
  /** Cuántos OTROS videos comparten este mismo archivo. */
  otros: number
  /** Las fechas de esos otros videos, únicas y ordenadas. Sin fecha no entra. */
  fechas: string[]
}

/** El archivo editado más reciente de una idea. Una resubida deja atrás el viejo. */
function editadoMasReciente(idea: IdeaConArchivos): ArchivoDeIdea | null {
  return (
    (idea.videos ?? [])
      .filter((v) => v.kind === 'edited' && v.storage_provider === 'entregas-r2')
      .sort((a, b) => ((a.uploaded_at ?? '') < (b.uploaded_at ?? '') ? 1 : -1))[0] ?? null
  )
}

/**
 * Identidad de un archivo: cliente + nombre + bytes.
 *
 * El cliente entra en la clave porque dos cuentas distintas pueden mandar un
 * "final.mp4" del mismo peso sin que tengan nada que ver, y cruzarlos
 * inventaría un problema donde no lo hay. Sin nombre o sin tamaño no se puede
 * afirmar que sean el mismo, así que no se afirma.
 */
function claveArchivo(idea: IdeaConArchivos, archivo: ArchivoDeIdea): string | null {
  if (!idea.client_id) return null
  const nombre = archivo.name?.trim()
  if (!nombre || archivo.size_bytes == null) return null
  return `${idea.client_id}|${nombre}|${archivo.size_bytes}`
}

export function archivosRepetidos(ideas: IdeaConArchivos[]): Record<string, Repetido> {
  const porArchivo = new Map<string, IdeaConArchivos[]>()

  for (const i of ideas) {
    // Lo descartado ya no está en el tablero: señalarlo sería mandar a mirar
    // una tarjeta que no existe.
    if (i.status === 'descartada') continue
    const archivo = editadoMasReciente(i)
    if (!archivo) continue
    const clave = claveArchivo(i, archivo)
    if (!clave) continue
    const lista = porArchivo.get(clave)
    if (lista) lista.push(i)
    else porArchivo.set(clave, [i])
  }

  const out: Record<string, Repetido> = {}
  for (const grupo of Array.from(porArchivo.values())) {
    if (grupo.length < 2) continue
    for (const i of grupo) {
      const otros = grupo.filter((o) => o.id !== i.id)
      out[i.id] = {
        otros: otros.length,
        fechas: Array.from(new Set(otros.map((o) => o.publish_date).filter(Boolean) as string[])).sort(),
      }
    }
  }
  return out
}
