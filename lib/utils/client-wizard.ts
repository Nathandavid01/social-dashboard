/**
 * Step model for the guided client-onboarding wizard (Clientes → Agregar cliente).
 * Pure + UI-free so it's unit-testable; the wizard component drives the actual
 * forms and server actions per step.
 *
 * Flow: create the client (datos) → connect Metricool → set cadence → brand
 * voice → "listo para automatizar" summary. Only `datos` is required to create;
 * the rest are skippable and can be completed later from the profile.
 */
export type WizardStepKey = 'datos' | 'metricool' | 'cadencia' | 'voz' | 'listo'

export interface WizardStep {
  key: WizardStepKey
  /** Short title shown in the stepper. */
  title: string
  /** One line on WHY this step matters (shown under the title). */
  why: string
  /** Optional steps can be skipped; `datos` (create) cannot. */
  optional: boolean
}

export const WIZARD_STEPS: WizardStep[] = [
  { key: 'datos', title: 'Datos del cliente', why: 'Lo mínimo para crearlo: nombre, redes e idioma de los captions.', optional: false },
  { key: 'metricool', title: 'Conectar Metricool', why: 'Vincula las cuentas para auto-publicar y traer métricas reales.', optional: true },
  { key: 'cadencia', title: 'Días de posteo', why: 'Define cuándo se publica para que el pipeline programe solo.', optional: true },
  { key: 'voz', title: 'Voz de marca', why: 'Guía a la IA de captions para que suene como el cliente.', optional: true },
  { key: 'listo', title: 'Listo para automatizar', why: 'Resumen de lo que quedó configurado.', optional: false },
]

/** 1-based position, total, and completion % for the progress bar. */
export function wizardProgress(key: WizardStepKey): { stepNumber: number; total: number; pct: number } {
  const total = WIZARD_STEPS.length
  const index = WIZARD_STEPS.findIndex((s) => s.key === key)
  const stepNumber = (index < 0 ? 0 : index) + 1
  // % of the journey completed once you've LANDED on this step.
  const pct = Math.round((index / (total - 1)) * 100)
  return { stepNumber, total, pct }
}

/** The client can only be created (step 1 → 2) with a name + at least one network. */
export function canCreateClient(values: { name?: string | null; platforms?: unknown[] | null }): boolean {
  return !!values.name && values.name.trim().length > 0 && Array.isArray(values.platforms) && values.platforms.length > 0
}

/** Key of the step after `key` (null if it's the last). */
export function nextStepKey(key: WizardStepKey): WizardStepKey | null {
  const i = WIZARD_STEPS.findIndex((s) => s.key === key)
  return i >= 0 && i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1].key : null
}

/** Key of the step before `key` (null if it's the first). */
export function prevStepKey(key: WizardStepKey): WizardStepKey | null {
  const i = WIZARD_STEPS.findIndex((s) => s.key === key)
  return i > 0 ? WIZARD_STEPS[i - 1].key : null
}
