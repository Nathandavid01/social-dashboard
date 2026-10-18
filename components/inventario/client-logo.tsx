'use client'

import { useState } from 'react'
import { clientInitials } from '@/lib/inventario/client-initials'
import { GOLD_HEX } from './stock-labels'

/**
 * Same medallion as the 3D scene: logo on white inside a ring in the health
 * color, or a gold monogram when there is no logo (or it fails to load).
 */
export function ClientLogo({
  name,
  src,
  ringHex,
  size = 'md',
}: {
  name: string
  src: string | null
  ringHex: string
  size?: 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const showLogo = !!src && !failed
  return (
    <span
      className={`relative flex shrink-0 ${size === 'lg' ? 'h-14 w-14 border-[3px]' : 'h-10 w-10 border-2'} items-center justify-center overflow-hidden rounded-full p-[2px]`}
      style={{ borderColor: ringHex }}
    >
      <span
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{ backgroundColor: showLogo ? '#ffffff' : '#0d0d0d', boxShadow: `inset 0 0 0 1px ${GOLD_HEX}55` }}
      >
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- same-origin proxy URL, sized by CSS
          <img
            src={src}
            alt={`Logo de ${name}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className={size === 'lg' ? 'text-lg font-bold' : 'text-[13px] font-bold'} style={{ color: GOLD_HEX }} aria-hidden>
            {clientInitials(name)}
          </span>
        )}
      </span>
    </span>
  )
}
