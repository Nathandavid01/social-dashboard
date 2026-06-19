'use client'

import { cn } from '@/lib/utils'

/**
 * Nate Media brand mark — "radar / torre de control".
 * A gold N monogram at the center of a live radar scope (range rings + sweeping
 * beam) on the negro + dorado brand. Reusable wherever the brand appears.
 *
 * `size` is the square px size of the mark. It's a client component because of
 * the animated sweep; importing it into a server component is fine.
 */
export function NateLogo({ size = 54, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Nate Media"
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-[15px] border border-white/10 shadow-lg shadow-primary/30 motion-reduce:[&_*]:!animate-none',
        className,
      )}
      style={{
        height: size,
        width: size,
        background: 'radial-gradient(circle at 50% 46%, #1c1810 0%, #0c0c0e 65%)',
      }}
    >
      {/* sonar ping */}
      <span
        aria-hidden
        className="absolute inset-0 m-auto rounded-full border border-[#f6d572]/50 animate-[ping_3.8s_cubic-bezier(0,0,0.2,1)_infinite]"
        style={{ width: size * 0.56, height: size * 0.56 }}
      />
      {/* rotating sweep */}
      <span aria-hidden className="absolute inset-0 animate-[spin_4.6s_linear_infinite]">
        <span
          className="absolute block rounded-full"
          style={{
            inset: size * 0.13,
            background:
              'conic-gradient(from 0deg, rgba(246,213,114,.5), rgba(227,178,43,.16) 32deg, rgba(246,213,114,0) 104deg, transparent 360deg)',
          }}
        />
        <span
          className="absolute left-1/2 block w-px -translate-x-1/2"
          style={{
            top: size * 0.13,
            bottom: '50%',
            background: 'linear-gradient(to top, rgba(252,233,166,0), #FCE9A6)',
          }}
        />
      </span>
      {/* scope overlay: rings + N */}
      <svg viewBox="0 0 120 120" width={size} height={size} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id="nate-n" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCE9A6" />
            <stop offset="55%" stopColor="#E3B22B" />
            <stop offset="100%" stopColor="#9C7209" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="#E3B22B" strokeWidth={1.4} opacity={0.25}>
          <circle cx="60" cy="60" r="46" />
          <circle cx="60" cy="60" r="30" />
        </g>
        <path
          d="M48 76 V44 L72 76 V44"
          fill="none"
          stroke="url(#nate-n)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
