import { z } from 'zod'

export const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100),
  industry: z.string().max(100).optional(),
  platforms: z.array(z.enum(['instagram', 'facebook', 'tiktok', 'linkedin'])).min(1, 'Select at least one platform'),
  status: z.enum(['active', 'paused', 'onboarding']),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional(),
  brand_voice: z.string().max(500).optional(),
  caption_language: z.enum(['spanish', 'english', 'spanglish']).default('spanish'),
  default_cta: z.string().max(300).optional(),
  default_hashtags: z.string().max(1000).optional(),
  metricool_blog_id: z.string().max(100).optional(),
  caption_notes: z.string().max(1000).optional(),
})

export type ClientFormValues = z.infer<typeof clientSchema>
