import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { estadoLabel, estadoTone } from '@/lib/clients/estado'

/**
 * El estado del cliente como badge.
 *
 * Antes tenía su propio `Record<ClientStatus, string>` de etiquetas y otro de
 * colores en lib/utils.ts. Con estado nuevo en la base de datos, un Record así
 * devuelve undefined y el badge sale en blanco — así que las dos tablas se
 * fueron a lib/clients/estado.ts, que es de donde salen también el desplegable y
 * los filtros.
 *
 * `status` es string a propósito: si aparece un estado que la interfaz no
 * conoce, se muestra tal cual en vez de desaparecer.
 */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', estadoTone(status))}>
      {estadoLabel(status)}
    </Badge>
  )
}
