import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'
import { clientAssigneeId, ideaAssigneeId } from './editor-video-bank'

const DAY = 86_400_000
const DEFAULT_WINDOW_DAYS = 30

/** Un video no cuenta si nunca llegó a existir de verdad. */
const LIVE = new Set<ContentIdeaVideo['status']>(['uploading', 'uploaded', 'processing'])
const SOURCE = new Set<ContentIdeaVideo['kind']>(['raw', 'broll'])

/**
 * Ritmo real de un editor: cuánto tarda entre que entra el crudo y entrega el
 * corte. Sale de `uploaded_at` de los videos que ya están guardados — no hace
 * falta ni una columna nueva.
 */
export interface EditorPace {
  editorId: string
  /** Mediana de días en la ventana actual. Mediana y no promedio: un video atascado no debe mover la cifra. */
  medianDays: number | null
  /** Entregas contadas en la ventana actual. */
  delivered: number
  /** Mediana de la ventana anterior del mismo largo. */
  previousMedianDays: number | null
  /** Positivo = se está tardando más que antes. Null si no hay con qué comparar. */
  trendDays: number | null
}

export interface EditorPaceOptions {
  now?: number
  windowDays?: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const raw = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return round1(raw)
}

function time(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

/** El primer crudo subido: cuándo entró el material a manos del editor. */
function firstSourceAt(videos: ContentIdeaVideo[] | null | undefined): number | null {
  const times = (videos ?? [])
    .filter((v) => SOURCE.has(v.kind) && LIVE.has(v.status))
    .map((v) => time(v.uploaded_at))
    .filter((t): t is number => t !== null)
  return times.length > 0 ? Math.min(...times) : null
}

/** El primer editado subido: cuándo entregó. */
function firstCutAt(videos: ContentIdeaVideo[] | null | undefined): number | null {
  const times = (videos ?? [])
    .filter((v) => v.kind === 'edited' && LIVE.has(v.status))
    .map((v) => time(v.uploaded_at))
    .filter((t): t is number => t !== null)
  return times.length > 0 ? Math.min(...times) : null
}

interface Delivery {
  editorId: string
  days: number
  cutAt: number
}

function deliveriesOf(ideas: IdeaWithPipeline[]): Delivery[] {
  const out: Delivery[] = []
  for (const idea of ideas) {
    if (idea.status === 'descartada') continue
    const editorId = ideaAssigneeId(idea) ?? clientAssigneeId(idea)
    if (!editorId) continue
    const rawAt = firstSourceAt(idea.videos)
    const cutAt = firstCutAt(idea.videos)
    if (rawAt === null || cutAt === null) continue
    const ms = cutAt - rawAt
    if (ms < 0) continue // fechas invertidas: dato sucio, no un editor rapidísimo
    // Entregar el mismo día es medio día de trabajo, no cero.
    out.push({ editorId, days: Math.max(0.5, round1(ms / DAY)), cutAt })
  }
  return out
}

/**
 * Ritmo por editor, ordenado del más rápido al más lento. Solo aparecen los
 * editores con al menos una entrega medible dentro de la ventana.
 */
export function buildEditorPace(ideas: IdeaWithPipeline[], options: EditorPaceOptions = {}): EditorPace[] {
  const now = options.now ?? Date.now()
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const currentFrom = now - windowDays * DAY
  const previousFrom = now - 2 * windowDays * DAY

  const current = new Map<string, number[]>()
  const previous = new Map<string, number[]>()

  for (const d of deliveriesOf(ideas)) {
    if (d.cutAt > now) continue
    if (d.cutAt >= currentFrom) {
      const list = current.get(d.editorId) ?? []
      list.push(d.days)
      current.set(d.editorId, list)
    } else if (d.cutAt >= previousFrom) {
      const list = previous.get(d.editorId) ?? []
      list.push(d.days)
      previous.set(d.editorId, list)
    }
  }

  const paces: EditorPace[] = []
  for (const [editorId, days] of Array.from(current.entries())) {
    const medianDays = median(days)
    const previousMedianDays = median(previous.get(editorId) ?? [])
    paces.push({
      editorId,
      medianDays,
      delivered: days.length,
      previousMedianDays,
      trendDays:
        medianDays !== null && previousMedianDays !== null ? round1(medianDays - previousMedianDays) : null,
    })
  }

  return paces.sort((a, b) => {
    const da = a.medianDays ?? Number.POSITIVE_INFINITY
    const db = b.medianDays ?? Number.POSITIVE_INFINITY
    return da === db ? a.editorId.localeCompare(b.editorId) : da - db
  })
}

/** Referencia del equipo: la mediana de las medianas, para no dejar que un editor con 40 entregas mande. */
export function teamMedianDays(paces: EditorPace[]): number | null {
  return median(paces.map((p) => p.medianDays).filter((d): d is number => d !== null))
}

/**
 * Cuánto tardaría este editor en sacar un video. Sin historial propio hereda la
 * referencia del equipo; sin historial de nadie no inventa un número.
 */
export function estimateDaysForEditor(
  pace: EditorPace | null | undefined,
  context: { teamMedianDays: number | null },
): number | null {
  return pace?.medianDays ?? context.teamMedianDays ?? null
}
