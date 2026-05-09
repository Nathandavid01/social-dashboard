import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['content_creation', 'scheduling', 'reporting', 'client_call', 'review', 'other']),
  client_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
  due_at: z.string().optional().nullable(),
  priority: z.number().min(1).max(3),
})

export type TaskFormValues = z.infer<typeof taskSchema>
