import { z } from 'zod'

const hex = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/i, 'Color debe ser hex de 6 dígitos (ej. #3E64DE)')
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v ?? null))

export const brandColorsSchema = z.object({
  primary: hex,
  secondary: hex,
  accent: hex,
  text: hex,
})

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v ?? null))

const phoneStr = z.string().max(50).nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null))
const text200 = z.string().max(200).nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null))
const text5000 = z.string().max(5000).nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null))
const emailMaybe = z
  .string()
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v ?? null))
  .refine((v) => v === null || v === undefined || /.+@.+\..+/.test(v), 'Email inválido')

export const clientProfilePatchSchema = z
  .object({
    owner_name: text200,
    owner_email: emailMaybe,
    owner_phone: phoneStr,
    brand_colors: brandColorsSchema.optional(),
    logo_url: z.string().nullable().optional(),
    logo_dark_url: z.string().nullable().optional(),
    posting_days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    video_threshold: z.union([z.number().int().min(0).max(500), z.string()]).optional().transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = typeof v === 'string' ? parseInt(v, 10) : v
      return Number.isFinite(n) ? Math.max(0, Math.min(500, n)) : undefined
    }),
    contract_url: z.string().nullable().optional(),
    contract_signed_at: dateOnly,
    contract_expires_at: dateOnly,
    monthly_fee: z
      .union([z.number().nonnegative(), z.string()])
      .nullable()
      .optional()
      .transform((v) => {
        if (v === null || v === undefined || v === '') return null
        const n = typeof v === 'string' ? Number(v) : v
        return Number.isFinite(n) ? n : null
      }),
    last_meeting_at: z.string().nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
    last_meeting_notes: text5000,
    brand_voice: text5000,
    default_cta: z.string().max(300).nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
    default_hashtags: z.string().max(1000).nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
    caption_notes: z.string().max(1000).nullable().optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
  })
  .partial()

export type ClientProfilePatch = z.input<typeof clientProfilePatchSchema>

export const paymentSchema = z.object({
  amount: z
    .union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido')])
    .transform((v) => (typeof v === 'string' ? Number(v) : v)),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  method: z.string().max(50).optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
  reference: z.string().max(100).optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
  notes: z.string().max(1000).optional().or(z.literal('')).transform((v) => (v === '' ? null : v ?? null)),
})

export type PaymentInput = z.input<typeof paymentSchema>
