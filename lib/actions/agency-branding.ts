'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertOwner } from '@/lib/auth/server'
import {
  coerceAgencyBranding,
  DEFAULT_AGENCY_BRANDING,
  type AgencyBranding,
  type LogoPreset,
} from '@/lib/utils/agency-branding'

const BUCKET = 'agency-branding'

const patchSchema = z.object({
  brand_name: z.string().max(60).optional(),
  tagline: z.string().max(80).optional(),
  logo_preset: z.enum(['nate_n', 'nate_radar', 'custom']).optional(),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().max(16).optional(),
  apply_on_login: z.boolean().optional(),
})

export type AgencyBrandingPatch = z.input<typeof patchSchema>

/** Read global branding (safe defaults if table missing or empty). */
export async function getAgencyBranding(): Promise<AgencyBranding> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('agency_branding')
      .select('brand_name, tagline, logo_preset, logo_url, primary_color, apply_on_login')
      .eq('id', 'global')
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_AGENCY_BRANDING }
    return coerceAgencyBranding(data as Partial<AgencyBranding>)
  } catch {
    return { ...DEFAULT_AGENCY_BRANDING }
  }
}

export async function updateAgencyBranding(
  input: AgencyBrandingPatch,
): Promise<{ ok?: true; branding?: AgencyBranding; error?: string }> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const parsed = patchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const current = await getAgencyBranding()
  const next = coerceAgencyBranding({ ...current, ...parsed.data })

  const { error } = await supabase
    .from('agency_branding')
    .update({
      brand_name: next.brand_name,
      tagline: next.tagline,
      logo_preset: next.logo_preset,
      logo_url: next.logo_url,
      primary_color: next.primary_color,
      apply_on_login: next.apply_on_login,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    })
    .eq('id', 'global')

  if (error) return { error: error.message }

  revalidateBrandingPaths()
  return { ok: true, branding: next }
}

export async function uploadAgencyLogo(
  formData: FormData,
): Promise<{ ok?: true; url?: string; branding?: AgencyBranding; error?: string }> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (!file.type.startsWith('image/')) return { error: 'Solo se permiten imágenes (PNG, JPG, SVG, WebP)' }
  if (file.size > 4 * 1024 * 1024) return { error: 'Imagen mayor a 4 MB' }

  const supabase = await createClient()
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `global/logo.${ext || 'png'}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const result = await updateAgencyBranding({
    logo_preset: 'custom' as LogoPreset,
    logo_url: url,
  })
  if (result.error) return { error: result.error }
  return { ok: true, url, branding: result.branding }
}

export async function resetAgencyBranding(): Promise<{ ok?: true; branding?: AgencyBranding; error?: string }> {
  return updateAgencyBranding({
    brand_name: DEFAULT_AGENCY_BRANDING.brand_name,
    tagline: DEFAULT_AGENCY_BRANDING.tagline,
    logo_preset: DEFAULT_AGENCY_BRANDING.logo_preset,
    logo_url: null,
    primary_color: DEFAULT_AGENCY_BRANDING.primary_color,
    apply_on_login: true,
  })
}

function revalidateBrandingPaths() {
  revalidatePath('/', 'layout')
  revalidatePath('/login')
  revalidatePath('/settings/branding')
  revalidatePath('/settings/workflow')
  revalidatePath('/home')
}
