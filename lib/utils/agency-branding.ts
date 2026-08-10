/**
 * Agency branding — pure helpers for logo preset resolution and brand display.
 * Defaults match the Nate Media negro + dorado identity.
 */

export type LogoPreset = 'nate_n' | 'nate_radar' | 'custom'

export interface AgencyBranding {
  brand_name: string
  tagline: string
  logo_preset: LogoPreset
  logo_url: string | null
  primary_color: string
  apply_on_login: boolean
}

export const DEFAULT_AGENCY_BRANDING: AgencyBranding = {
  brand_name: 'Nate Media',
  tagline: 'Operaciones de contenido',
  logo_preset: 'nate_n',
  logo_url: null,
  primary_color: '#D4A017',
  apply_on_login: true,
}

/** Built-in logo assets shipped with the app (not custom uploads). */
export const LOGO_PRESETS: {
  id: LogoPreset
  label: string
  description: string
  /** Static src for img tags; null means render the animated NateLogo component. */
  staticSrc: string | null
}[] = [
  {
    id: 'nate_n',
    label: 'N monograma',
    description: 'N dorada sobre negro — ícono clásico de Nate Media',
    staticSrc: '/icons/icon-512.svg',
  },
  {
    id: 'nate_radar',
    label: 'Radar / torre de control',
    description: 'Monograma animado con barrido (login y marca viva)',
    staticSrc: null,
  },
  {
    id: 'custom',
    label: 'Logo propio',
    description: 'Sube el logo de tu agencia (PNG, SVG o JPG)',
    staticSrc: null,
  },
]

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return false
  return HEX_COLOR.test(value.trim())
}

/** Normalize a user-entered color; invalid → default gold. */
export function normalizePrimaryColor(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  if (!isValidHexColor(v)) return DEFAULT_AGENCY_BRANDING.primary_color
  // Expand #RGB → #RRGGBB
  if (v.length === 4) {
    const r = v[1], g = v[2], b = v[3]
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return v.toUpperCase()
}

export function normalizeBrandName(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  return v.length > 0 ? v.slice(0, 60) : DEFAULT_AGENCY_BRANDING.brand_name
}

export function normalizeTagline(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  return v.length > 0 ? v.slice(0, 80) : DEFAULT_AGENCY_BRANDING.tagline
}

export function normalizeLogoPreset(value: string | null | undefined): LogoPreset {
  if (value === 'nate_n' || value === 'nate_radar' || value === 'custom') return value
  return DEFAULT_AGENCY_BRANDING.logo_preset
}

/**
 * Resolve which image URL (if any) to show for the mark.
 * - nate_n → static SVG
 * - nate_radar → null (caller renders <NateLogo />)
 * - custom → uploaded URL, or falls back to nate_n if missing
 */
export function resolveLogoImageSrc(
  preset: LogoPreset,
  logoUrl: string | null | undefined,
): { kind: 'image'; src: string } | { kind: 'radar' } {
  if (preset === 'nate_radar') return { kind: 'radar' }
  if (preset === 'custom') {
    const url = (logoUrl ?? '').trim()
    if (url) return { kind: 'image', src: url }
    return { kind: 'image', src: '/icons/icon-512.svg' }
  }
  return { kind: 'image', src: '/icons/icon-512.svg' }
}

/** Split "Nate Media" → { head: "Nate", accent: "Media" } for the gold last-word style. */
export function splitBrandName(name: string): { head: string; accent: string } {
  const parts = normalizeBrandName(name).split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { head: parts[0] ?? DEFAULT_AGENCY_BRANDING.brand_name, accent: '' }
  return {
    head: parts.slice(0, -1).join(' '),
    accent: parts[parts.length - 1]!,
  }
}

/** Coerce a DB row (or partial) into a safe AgencyBranding. */
export function coerceAgencyBranding(row: Partial<AgencyBranding> | null | undefined): AgencyBranding {
  if (!row) return { ...DEFAULT_AGENCY_BRANDING }
  const preset = normalizeLogoPreset(row.logo_preset)
  const logo_url =
    typeof row.logo_url === 'string' && row.logo_url.trim() ? row.logo_url.trim() : null
  return {
    brand_name: normalizeBrandName(row.brand_name),
    tagline: normalizeTagline(row.tagline),
    logo_preset: preset,
    logo_url,
    primary_color: normalizePrimaryColor(row.primary_color),
    apply_on_login: row.apply_on_login !== false,
  }
}
