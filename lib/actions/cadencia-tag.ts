/**
 * Etiqueta de caché de la cadencia.
 *
 * En su propio fichero porque cadencia.ts es 'use server' —ahí solo pueden
 * exportarse funciones async— y porque quien invalida (clients.ts) no debe
 * arrastrar el módulo entero de Metricool solo para leer una constante.
 *
 * La cadencia del día se sirve de un unstable_cache de 10 minutos.
 * revalidatePath NO limpia ese tipo de caché: hace falta revalidateTag con esta
 * etiqueta. Sin ella, pausar un cliente lo dejaba en la cadencia del día hasta
 * 10 minutos más, como si siguiera activo.
 */
export const CADENCIA_TAG = 'cadencia'
