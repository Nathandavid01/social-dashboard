'use client'

import * as Sentry from '@sentry/nextjs'
import { useState } from 'react'

export function SentryTestClient() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  async function sendTestEvent() {
    setStatus('sending')
    Sentry.captureException(new Error('Sentry browser verification - Nate Media social dashboard'), {
      tags: { verification: 'codex-browser-project-init' },
    })
    setStatus((await Sentry.flush(5_000)) ? 'sent' : 'failed')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Verificación local de Sentry</h1>
      <p>Esta ruta solo está disponible durante desarrollo.</p>
      <button
        type="button"
        onClick={sendTestEvent}
        disabled={status === 'sending'}
        className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        Enviar error de prueba
      </button>
      <p role="status">
        {status === 'idle' && 'Listo'}
        {status === 'sending' && 'Enviando…'}
        {status === 'sent' && 'Evento enviado'}
        {status === 'failed' && 'Sentry no confirmó el envío'}
      </p>
    </main>
  )
}
