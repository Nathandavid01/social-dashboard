import { Clapperboard, CheckCircle2, BarChart3 } from 'lucide-react'
import { NateLogo } from '@/components/shared/nate-logo'

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

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* Brand showcase — always dark (Nate Media negro + dorado) */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* decorative gold glow + faint grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-amber-600/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:38px_38px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950" />
        </div>

        {/* top: wordmark */}
        <div className="relative flex items-center gap-3">
          <NateLogo size={44} />
          <div className="flex flex-col leading-none">
            <span className="text-lg font-semibold tracking-tight text-white">Nate Media</span>
            <span className="text-xs text-zinc-400">Operaciones de contenido</span>
          </div>
        </div>

        {/* middle: headline + features */}
        <div className="relative max-w-md">
          <h2 className="text-[28px] font-bold leading-[1.15] tracking-tight text-white xl:text-4xl">
            El sistema operativo de tu agencia de contenido.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Planifica, produce, aprueba y publica — con el equipo alineado y cada video a tiempo.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
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
            <NateLogo size={52} />
            <h1 className="mt-3 text-xl font-bold tracking-tight">Nate Media</h1>
            <p className="text-sm text-muted-foreground">Operaciones de contenido</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
