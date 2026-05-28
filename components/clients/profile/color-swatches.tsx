import type { BrandColors } from '@/lib/supabase/types'

interface Props {
  colors: BrandColors | null | undefined
}

const SWATCHES: { key: keyof BrandColors; label: string }[] = [
  { key: 'primary', label: 'Primario' },
  { key: 'secondary', label: 'Secundario' },
  { key: 'accent', label: 'Acento' },
  { key: 'text', label: 'Texto' },
]

export function ColorSwatches({ colors }: Props) {
  const hasAny = colors && SWATCHES.some((s) => colors[s.key])
  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">Aún no se han configurado colores. Edítalos en la pestaña Marca.</p>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SWATCHES.map((s, i) => {
        const hex = colors?.[s.key]
        if (!hex) return null
        return (
          <div
            key={s.key}
            className="group relative overflow-hidden rounded-lg border bg-card transition-transform hover:-translate-y-0.5 hover:shadow-md animate-in fade-in zoom-in-95 duration-300"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
          >
            <div className="h-16 w-full transition-transform duration-300 group-hover:scale-105" style={{ background: hex }} />
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="font-mono text-xs">{hex.toUpperCase()}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
