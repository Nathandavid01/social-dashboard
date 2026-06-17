export const metadata = { title: 'Sin conexión — NMedia' }

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No hay conexión a internet. Verifica tu red y toca Reintentar cuando regrese la conexión.
      </p>
      <a
        href="/home"
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        Reintentar
      </a>
    </main>
  )
}
