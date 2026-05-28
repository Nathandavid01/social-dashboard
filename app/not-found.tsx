import Link from 'next/link'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-5 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Compass className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold">404</h1>
          <p className="text-sm text-muted-foreground">
            La página que buscas no existe o se movió.
          </p>
        </div>
        <Button asChild>
          <Link href="/home">
            <Home className="mr-1.5 h-3.5 w-3.5" /> Volver al inicio
          </Link>
        </Button>
      </div>
    </div>
  )
}
