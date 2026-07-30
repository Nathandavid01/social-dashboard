/**
 * Pure onboarding-readiness check for a client. Maps each item 1:1 to what it
 * unlocks downstream, so the UI can show a live "Listo para automatizar"
 * checklist. Kept free of Supabase so it's unit-testable.
 *
 * Required items (active + metricool + cadence) are what the core automations
 * need: auto-provision del lote, captions con estilo, y auto-publicación.
 */
export type OnboardingKey = 'active' | 'metricool' | 'cadence' | 'voice' | 'firstVideo'

export interface OnboardingItem {
  key: OnboardingKey
  label: string
  done: boolean
  required: boolean
  hint: string
}

export interface OnboardingStatus {
  items: OnboardingItem[]
  doneCount: number
  total: number
  /** Every item satisfied. */
  complete: boolean
  /** The 3 required items satisfied → core automations will fire. */
  automatable: boolean
}

const filled = (s?: string | null) => !!s && s.trim().length > 0

export function clientOnboardingStatus(c: {
  status?: string | null
  metricool_blog_id?: string | null
  posting_days?: number[] | null
  brand_voice?: string | null
  hasVideos?: boolean
}): OnboardingStatus {
  const items: OnboardingItem[] = [
    {
      key: 'active',
      label: 'Cliente activo',
      required: true,
      done: c.status === 'active',
      hint: 'Actívalo para que el contenido se planifique y publique solo.',
    },
    {
      key: 'metricool',
      label: 'Metricool conectado',
      required: true,
      done: filled(c.metricool_blog_id),
      hint: 'Necesario para captions con su estilo y para auto-publicar.',
    },
    {
      key: 'cadence',
      label: 'Días de posteo',
      required: true,
      done: (c.posting_days?.length ?? 0) > 0,
      hint: 'Define qué días postea para generar el lote de videos.',
    },
    {
      key: 'voice',
      label: 'Voz de marca',
      required: false,
      done: filled(c.brand_voice),
      hint: 'Mejora los captions de IA (opcional, recomendado).',
    },
    {
      key: 'firstVideo',
      label: 'Primer lote creado',
      required: false,
      done: !!c.hasVideos,
      hint: 'Crea el primer lote para empezar a producir.',
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  return {
    items,
    doneCount,
    total: items.length,
    complete: doneCount === items.length,
    automatable: items.filter((i) => i.required).every((i) => i.done),
  }
}
