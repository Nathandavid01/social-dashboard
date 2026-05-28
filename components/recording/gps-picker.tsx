'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { MapPin, Crosshair, ExternalLink, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  address: string
  lat: number | null
  lng: number | null
  onChange: (next: { address: string; lat: number | null; lng: number | null }) => void
  /** Compact mode for narrower contexts. */
  compact?: boolean
}

export function GpsPicker({ address, lat, lng, onChange, compact }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador.')
      return
    }
    setPending(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPending(false)
        const newLat = Number(pos.coords.latitude.toFixed(6))
        const newLng = Number(pos.coords.longitude.toFixed(6))
        onChange({ address, lat: newLat, lng: newLng })
      },
      (err) => {
        setPending(false)
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso denegado. Habilita la ubicación en el navegador.'
            : 'No se pudo obtener tu ubicación.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const hasCoords = lat !== null && lng !== null
  const mapsHref = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : address.trim()
      ? `https://www.google.com/maps?q=${encodeURIComponent(address.trim())}`
      : null

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <Label className="flex items-center gap-1 text-xs">
        <MapPin className="h-3 w-3" /> Dirección de la grabación
      </Label>
      <div className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => onChange({ address: e.target.value, lat, lng })}
          placeholder="Calle, número, ciudad…"
          className="h-9 flex-1 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={useCurrentLocation}
          className="shrink-0 transition-transform hover:scale-105"
          title="Usar mi ubicación actual"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          <span className="ml-1 hidden sm:inline">Usar GPS</span>
        </Button>
      </div>

      {hasCoords && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 p-2 text-xs animate-in fade-in slide-in-from-top-1 duration-300">
          <MapPin className="h-3 w-3 shrink-0 text-green-500" />
          <span className="font-mono tabular-nums">
            {lat!.toFixed(6)}, {lng!.toFixed(6)}
          </span>
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
            >
              Abrir en Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onChange({ address, lat: null, lng: null })}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Quitar coordenadas"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {!hasCoords && address.trim() && mapsHref && (
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Buscar dirección en Maps <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
