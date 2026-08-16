'use client'

import { useState } from 'react'

/**
 * The Nate Media "N" (public/icons/icon-512.svg), filling from the bottom up
 * with the real upload percent — not a decorative loader, actual progress.
 * The un-filled part stays a dim gray so it always reads as "the rest of
 * the N", never a random shape.
 */
export function NateUploadLogo({ pct, size = 40 }: { pct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const fillHeight = (512 * clamped) / 100
  const fillY = 512 - fillHeight

  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  )

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={`Subiendo ${Math.round(clamped)}%`}
    >
      <defs>
        <linearGradient id="nate-upload-fill-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0C040" />
          <stop offset="50%" stopColor="#D4A017" />
          <stop offset="100%" stopColor="#A87B0C" />
        </linearGradient>
        <clipPath id="nate-upload-fill-clip">
          <rect
            data-testid="nate-upload-fill-rect"
            x={0}
            y={fillY}
            width={512}
            height={fillHeight}
            style={{ transition: reducedMotion ? 'none' : 'y 300ms ease-out, height 300ms ease-out' }}
          />
        </clipPath>
      </defs>
      <rect width="512" height="512" fill="#0A0A0A" rx="100" />
      {/* Dim, un-filled N — always visible under the gold fill. */}
      <path
        d="M163 382 V130 L349 382 V130"
        fill="none"
        stroke="#3A3A3A"
        strokeWidth="58"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The real progress: gold N, clipped to the filled portion only. */}
      <g clipPath="url(#nate-upload-fill-clip)">
        <path
          d="M163 382 V130 L349 382 V130"
          fill="none"
          stroke="url(#nate-upload-fill-gradient)"
          strokeWidth="58"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
