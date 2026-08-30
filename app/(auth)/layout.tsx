import { NateLogo } from '@/components/shared/nate-logo'

// Login simple: una sola tarjeta centrada con el logo — sin panel de marketing.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6 py-12">
      {/* subtle gold glow, always-dark brand backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:[&_*]:!animate-none">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl motion-safe:animate-aurora1" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <NateLogo size={64} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            <span>Nate</span>
            <span className="bg-gradient-to-r from-[#FCE9A6] via-[#E3B22B] to-[#D4A017] bg-clip-text text-transparent">
              {' '}
              Media
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Operaciones de contenido</p>
        </div>
        {children}
        <p className="mt-10 text-center text-xs text-muted-foreground/70">
          © 2026 Nate Media
        </p>
      </div>
    </div>
  )
}
