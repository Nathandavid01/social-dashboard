'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

/**
 * Asignación masiva de clientes a editor y diseñador.
 *
 * Existe porque repartir 66 clientes por el formulario completo son 66
 * pantallas, cada una con veinte campos que no vienes a tocar.
 */

export async function setClientAssignment(input: {
  clientId: string
  /** 'editor' escribe assigned_to; 'disenador' escribe assigned_designer. */
  campo: 'editor' | 'disenador'
  /** null desasigna. */
  userId: string | null
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('clients.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const columna = input.campo === 'editor' ? 'assigned_to' : 'assigned_designer'

  const supabase = await createClient()
  // .select() para saber CUÁNTAS filas cambiaron: un UPDATE bloqueado por RLS
  // no da error en Postgres, actualiza 0 filas. Sin esto la acción devolvía
  // "ok" y la pantalla confirmaba un guardado que nunca ocurrió — que es como
  // los supervisores creyeron estar asignando editores durante semanas.
  const { data, error } = await supabase
    .from('clients')
    .update({ [columna]: input.userId })
    .eq('id', input.clientId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'No se guardó: no tienes permiso para editar este cliente.' }
  }

  // Las dos pantallas del flujo filtran por asignación: sin esto seguirían
  // enseñando el reparto viejo hasta la próxima recarga completa.
  revalidatePath('/clients/asignaciones')
  revalidatePath('/revision')
  revalidatePath('/entregas')
  return { ok: true }
}
