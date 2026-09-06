'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { imageConfigError, imageModelId } from '@/lib/llm/image-llm'
import { generateGraphicImages, editGraphicImage, enhanceConceptText } from '@/lib/llm/image-llm'
import { isGraphicAspectRatio, type GraphicAspectRatio } from '@/lib/llm/image-llm-core'
import { buildGraphicPrompt } from '@/lib/utils/graphic-prompt'
import { buildConceptEnhancePrompt } from '@/lib/utils/graphic-concept-prompt'
import type { BrandColors, BrandFonts } from '@/lib/supabase/types'

const GRAPHICS_BUCKET = 'client-assets'
/** UI cap — the API allows up to 10 but 4 variants per tirada is plenty. */
const MAX_GRAPHICS_PER_RUN = 4

export interface GeneratedGraphicResult {
  id: string | null
  url: string
}

export interface GenerateGraphicsResponse {
  images?: GeneratedGraphicResult[]
  model?: string
  error?: string
}

/**
 * "Mejorar descripción": convierte la idea cruda del equipo en una descripción
 * rica para la gráfica, usando los datos de marca del cliente. Con foto usa
 * Grok visión (mira la foto de verdad). La respuesta va al textarea, editable.
 */
export async function enhanceGraphicConcept(input: {
  clientId: string
  concept: string
  referenceImageUrl?: string | null
}): Promise<{ concept?: string; error?: string }> {
  try {
    await requirePermission('graphics.generate')
  } catch {
    return { error: 'No tienes permiso para generar gráficas.' }
  }
  const configError = imageConfigError(process.env)
  if (configError) return { error: configError }

  const concept = input.concept.trim()
  if (!concept) return { error: 'Escribe tu idea primero, aunque sea corta.' }
  if (!input.clientId) return { error: 'Elige un cliente.' }
  const refUrl = (input.referenceImageUrl ?? '').trim() || null
  if (refUrl && !refUrl.startsWith('https://')) return { error: 'La foto de referencia no es válida.' }

  const supabase = await createClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('name, industry, brand_voice, caption_notes')
    .eq('id', input.clientId)
    .single()
  if (clientError || !client) return { error: 'No se encontró el cliente.' }

  const prompt = buildConceptEnhancePrompt({
    concept,
    clientName: client.name,
    industry: client.industry,
    brandVoice: client.brand_voice,
    captionNotes: client.caption_notes,
    hasPhoto: !!refUrl,
  })

  try {
    const improved = (await enhanceConceptText(prompt, { imageUrl: refUrl })).trim()
    if (!improved) return { error: 'La IA no devolvió una descripción. Intenta de nuevo.' }
    return { concept: improved }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No se pudo mejorar la descripción.' }
  }
}

/**
 * Generate brand-aware graphics for a client with Grok Imagine, persist each
 * PNG to the public client-assets bucket and index it in generated_graphics.
 * Persistence is best-effort (like saved_captions): a storage/DB hiccup never
 * loses the generated images — worst case they aren't in the history.
 */
export async function generateClientGraphics(input: {
  clientId: string
  concept: string
  aspectRatio: string
  count: number
  /** Foto propia (URL pública en client-assets) como base — image-to-image. */
  referenceImageUrl?: string | null
}): Promise<GenerateGraphicsResponse> {
  try {
    await requirePermission('graphics.generate')
  } catch {
    return { error: 'No tienes permiso para generar gráficas.' }
  }

  const configError = imageConfigError(process.env)
  if (configError) return { error: configError }

  const concept = input.concept.trim()
  if (!concept) return { error: 'Describe qué debe mostrar la gráfica.' }
  if (!input.clientId) return { error: 'Elige un cliente.' }
  const refUrl = (input.referenceImageUrl ?? '').trim() || null
  if (refUrl && !refUrl.startsWith('https://')) return { error: 'La foto de referencia no es válida.' }
  // Con foto propia el formato lo define la foto; sin foto, exigimos un ratio válido.
  let aspectRatio: GraphicAspectRatio | null = null
  if (!refUrl) {
    if (!isGraphicAspectRatio(input.aspectRatio)) return { error: 'Formato de imagen no válido.' }
    aspectRatio = input.aspectRatio
  }
  const count = Math.min(MAX_GRAPHICS_PER_RUN, Math.max(1, Math.floor(input.count || 1)))

  const supabase = await createClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    // '*' a propósito: pedir brand_fonts explícito rompería con la migración
    // 0073 sin aplicar; con '*' el campo simplemente llega undefined.
    .select('*')
    .eq('id', input.clientId)
    .single()
  if (clientError || !client) return { error: 'No se encontró el cliente.' }

  const prompt = buildGraphicPrompt({
    concept,
    clientName: client.name,
    industry: client.industry,
    brandVoice: client.brand_voice,
    captionLanguage: client.caption_language,
    brandColors: (client.brand_colors ?? null) as BrandColors | null,
    // Cast: hasta aplicar la migración 0073 la columna puede no existir.
    brandFonts: ((client as { brand_fonts?: BrandFonts | null }).brand_fonts ?? null),
    captionNotes: client.caption_notes,
    fromPhoto: !!refUrl,
  })

  let images: string[]
  try {
    if (refUrl) {
      // El endpoint de edits no acepta `n`: una llamada por variante.
      const settled = await Promise.allSettled(
        Array.from({ length: count }, () => editGraphicImage(prompt, { imageUrl: refUrl })),
      )
      images = settled
        .filter((s): s is PromiseFulfilledResult<string | null> => s.status === 'fulfilled')
        .map((s) => s.value)
        .filter((v): v is string => !!v)
      if (images.length === 0) {
        const firstError = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected')
        throw firstError?.reason instanceof Error
          ? firstError.reason
          : new Error('La IA no devolvió imágenes. Intenta de nuevo.')
      }
    } else {
      images = await generateGraphicImages(prompt, { n: count, aspectRatio: aspectRatio! })
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'La generación de imágenes falló.' }
  }
  if (images.length === 0) return { error: 'La IA no devolvió imágenes. Intenta de nuevo.' }

  const { data: auth } = await supabase.auth.getUser()
  const model = imageModelId(process.env)
  const batch = Date.now()
  const results: GeneratedGraphicResult[] = []

  for (const [i, b64] of images.entries()) {
    const path = `generated-graphics/${input.clientId}/${batch}-${i + 1}.png`
    const { error: upError } = await supabase.storage
      .from(GRAPHICS_BUCKET)
      .upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/png', cacheControl: '3600' })
    if (upError) return { error: `No se pudo guardar la imagen: ${upError.message}` }
    const { data: pub } = supabase.storage.from(GRAPHICS_BUCKET).getPublicUrl(path)

    let rowId: string | null = null
    try {
      const { data: row } = await supabase
        .from('generated_graphics')
        .insert({
          client_id: input.clientId,
          generated_by: auth?.user?.id ?? null,
          concept,
          prompt,
          aspect_ratio: aspectRatio ?? 'auto',
          model,
          image_url: pub.publicUrl,
          storage_path: path,
          source_image_url: refUrl,
        })
        .select('id')
        .single()
      rowId = row?.id ?? null
    } catch {
      // Best-effort persist — never fail the generation over history.
    }
    results.push({ id: rowId, url: pub.publicUrl })
  }

  return { images: results, model }
}
