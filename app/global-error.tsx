'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Error boundary de la raíz: lo único que atrapa un fallo del root layout o del
 * render de React. Reemplaza el documento entero, así que lleva su propio
 * <html> y no puede apoyarse en nada del layout — ni en los estilos.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
            Algo se rompió
          </h1>
          <p style={{ color: '#a3a3a3', margin: '12px 0 0', lineHeight: 1.55 }}>
            El fallo ya se reportó solo. Reintenta; si vuelve a pasar, avísale a Eric
            {error.digest ? ` con este código: ${error.digest}` : ''}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '24px',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: '#eab308',
              color: '#0a0a0a',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
