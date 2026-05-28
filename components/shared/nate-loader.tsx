import { cn } from '@/lib/utils'

interface Props {
  /** Full-screen overlay on a dark backdrop (default) or inline-compact for cards. */
  variant?: 'fullscreen' | 'inline'
  /** Show "NATE MEDIA" wordmark below the icon. Default true on fullscreen, false on inline. */
  showWordmark?: boolean
  /** Optional sub-label under the wordmark (e.g. "Cargando clientes…"). */
  label?: string
  className?: string
}

/**
 * Brand loader for Nate Media.
 *
 * Animations are pure CSS so the loader works in Server Components — no React
 * runtime cost. The bars grow from the baseline, the arrow draws stroke-by-stroke
 * (stroke-dasharray), and the wordmark fades in with a slight letter-spacing
 * relax. After the initial choreography it loops with a subtle pulse.
 *
 * Why this shape: the logo is essentially a bar chart with a growth arrow —
 * staggering the bars + drawing the arrow communicates "data is loading,
 * something is on the rise", which fits the product story.
 */
export function NateLoader({
  variant = 'fullscreen',
  showWordmark,
  label,
  className,
}: Props) {
  const wm = showWordmark ?? variant === 'fullscreen'

  return (
    <div
      className={cn(
        variant === 'fullscreen'
          ? 'fixed inset-0 z-50 grid place-items-center bg-black'
          : 'grid place-items-center',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Cargando'}
    >
      <div className={cn('flex flex-col items-center gap-6', variant === 'inline' && 'gap-2')}>
        <svg
          viewBox="0 0 220 160"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            'nate-loader-svg',
            variant === 'fullscreen' ? 'h-44 w-44 md:h-56 md:w-56' : 'h-12 w-12',
          )}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="nateGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E5B528" />
              <stop offset="50%" stopColor="#D4A017" />
              <stop offset="100%" stopColor="#B8870E" />
            </linearGradient>
            <filter id="nateGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bars — staggered grow from baseline */}
          <g className="nate-bars" filter="url(#nateGlow)">
            <rect className="nate-bar nate-bar-1" x="48"  y="60"  width="16" height="60"  rx="2" fill="url(#nateGold)" />
            <rect className="nate-bar nate-bar-2" x="78"  y="30"  width="16" height="90"  rx="2" fill="url(#nateGold)" />
            <rect className="nate-bar nate-bar-3" x="108" y="14"  width="16" height="106" rx="2" fill="url(#nateGold)" />
            <rect className="nate-bar nate-bar-4" x="138" y="48"  width="16" height="72"  rx="2" fill="url(#nateGold)" />
          </g>

          {/* Growth arrow — drawn via stroke-dashoffset; arrow head is a separate
              path so it can pop in after the line completes. */}
          <path
            className="nate-line"
            d="M30 124 L60 96 L90 110 L120 70 L170 38"
            fill="none"
            stroke="url(#nateGold)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#nateGlow)"
          />
          <path
            className="nate-arrowhead"
            d="M156 30 L182 28 L180 56 Z"
            fill="url(#nateGold)"
            filter="url(#nateGlow)"
          />
        </svg>

        {wm && (
          <div className="flex flex-col items-center gap-2">
            <p className="nate-wordmark text-2xl font-black tracking-[0.25em] text-white md:text-3xl">
              NATE&nbsp;MEDIA
            </p>
            {/* Indeterminate underline bar */}
            <div className="nate-progress h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
              <div className="nate-progress-fill h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#D4A017] to-transparent" />
            </div>
            {label && (
              <p className="nate-label mt-1 text-xs uppercase tracking-[0.3em] text-white/50">
                {label}
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`
        .nate-bar {
          transform-origin: center bottom;
          transform-box: fill-box;
          opacity: 0;
          animation: nate-bar-grow 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards,
                     nate-bar-pulse 2.6s ease-in-out 1.6s infinite;
        }
        .nate-bar-1 { animation-delay: 0ms,   1600ms; }
        .nate-bar-2 { animation-delay: 90ms,  1700ms; }
        .nate-bar-3 { animation-delay: 180ms, 1800ms; }
        .nate-bar-4 { animation-delay: 270ms, 1900ms; }

        @keyframes nate-bar-grow {
          0%   { transform: scaleY(0);    opacity: 0; }
          60%  { transform: scaleY(1.06); opacity: 1; }
          100% { transform: scaleY(1);    opacity: 1; }
        }
        @keyframes nate-bar-pulse {
          0%, 100% { transform: scaleY(1);    filter: brightness(1);    }
          50%      { transform: scaleY(0.96); filter: brightness(1.18); }
        }

        .nate-line {
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          animation: nate-draw 900ms cubic-bezier(0.65, 0, 0.35, 1) 350ms forwards,
                     nate-line-shimmer 2.6s ease-in-out 2s infinite;
        }
        @keyframes nate-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes nate-line-shimmer {
          0%, 100% { filter: brightness(1)    drop-shadow(0 0 0 transparent); }
          50%      { filter: brightness(1.25) drop-shadow(0 0 6px rgba(212, 160, 23, 0.55)); }
        }

        .nate-arrowhead {
          opacity: 0;
          transform: scale(0.6);
          transform-origin: 169px 42px;
          transform-box: fill-box;
          animation: nate-arrow-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) 1150ms forwards;
        }
        @keyframes nate-arrow-pop {
          0%   { opacity: 0; transform: scale(0.6) rotate(-12deg); }
          70%  { opacity: 1; transform: scale(1.12) rotate(3deg); }
          100% { opacity: 1; transform: scale(1)    rotate(0deg); }
        }

        .nate-wordmark {
          opacity: 0;
          letter-spacing: 0.7em;
          animation: nate-wordmark-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 1100ms forwards;
        }
        @keyframes nate-wordmark-in {
          0%   { opacity: 0; letter-spacing: 0.7em;  transform: translateY(8px); }
          100% { opacity: 1; letter-spacing: 0.25em; transform: translateY(0);   }
        }

        .nate-progress-fill {
          animation: nate-progress 1.4s ease-in-out infinite;
        }
        @keyframes nate-progress {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(420%);  }
        }

        .nate-label {
          opacity: 0;
          animation: nate-label-in 500ms ease-out 1700ms forwards;
        }
        @keyframes nate-label-in {
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nate-bar, .nate-line, .nate-arrowhead, .nate-wordmark, .nate-label, .nate-progress-fill {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
