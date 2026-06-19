import { Clapperboard, CheckCircle2, BarChart3 } from 'lucide-react'
import { NateLogo } from '@/components/shared/nate-logo'
import { LiveReachCounter } from '@/components/brand/live-reach-counter'
import { getAgencyReach } from '@/lib/actions/agency-reach'

// Don't let the (cold-cache) Metricool aggregation block the login render —
// fall back to the synthetic counter if it's slow.
async function reachWithTimeout(): Promise<number | null> {
  return Promise.race([
    getAgencyReach().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
  ])
}

const FEATURES = [
  {
    icon: Clapperboard,
    title: 'Pipeline de contenido',
    desc: 'De la idea a la publicación, con todo el equipo en un solo tablero.',
  },
  {
    icon: CheckCircle2,
    title: 'Aprobación y auto-publicación',
    desc: 'Aprueba el video y se publica solo, en su fecha y plataforma.',
  },
  {
    icon: BarChart3,
    title: 'Equipo y métricas',
    desc: 'Asignaciones, fechas límite y la producción de cada persona.',
  },
] as const

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const realReach = await reachWithTimeout()
  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* Brand showcase — always dark (Nate Media negro + dorado) */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* decorative gold glow + faint grid (animated) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:[&_*]:!animate-none">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl motion-safe:animate-aurora1" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-amber-600/10 blur-3xl motion-safe:animate-aurora2" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:38px_38px] motion-safe:animate-grid" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950" />
        </div>

        {/* top: wordmark */}
        <div className="relative flex items-center gap-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-500">
          <NateLogo size={54} />
          <div className="flex flex-col leading-none">
            <span className="text-[27px] font-extrabold tracking-tight">
              <span className="text-white">Nate</span>
              <span className="bg-gradient-to-r from-[#FCE9A6] via-[#E3B22B] to-[#D4A017] bg-clip-text text-transparent">
                {' '}
                Media
              </span>
            </span>
            <span className="mt-1 text-xs text-zinc-400">Operaciones de contenido</span>
          </div>
        </div>

        {/* middle: headline + features + live counter */}
        <div className="relative max-w-md">
          <h2 className="text-[28px] font-bold leading-[1.15] tracking-tight text-white duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 xl:text-4xl">
            El sistema operativo de tu agencia de contenido.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Planifica, produce, aprueba y publica — con el equipo alineado y cada video a tiempo.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="flex gap-3.5 fill-mode-both duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2"
                style={{ animationDelay: `${150 + i * 90}ms` }}
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <f.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">{f.title}</p>
                  <p className="text-[13px] leading-snug text-zinc-400">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <LiveReachCounter realReach={realReach} />
        </div>

        {/* bottom: legal */}
        <p className="relative text-xs text-zinc-500">
          © 2026 Nate Media · Hecho para agencias que se toman en serio su contenido.
        </p>
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* brand for mobile (left panel is hidden) */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <NateLogo size={56} />
            <h1 className="mt-3 text-xl font-bold tracking-tight">
              <span>Nate</span>
              <span className="bg-gradient-to-r from-[#FCE9A6] to-[#D4A017] bg-clip-text text-transparent">
                {' '}
                Media
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">Operaciones de contenido</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
