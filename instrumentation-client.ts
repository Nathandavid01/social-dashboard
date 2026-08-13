import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sin esto, los errores de tu máquina, de staging y de producción caen en el
  // mismo saco y no se pueden filtrar. En Vercel `NEXT_PUBLIC_VERCEL_ENV` es
  // production/preview/development; en local no existe y cae a NODE_ENV.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Session Replay: 10% de las sesiones, y el 100% de las que tienen un error.
  // El texto y los medios van enmascarados por defecto — esta app enseña datos
  // de clientes en pantalla y una grabación sin enmascarar sería una fuga.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})

// Los cambios de ruta del App Router. Sin esto, una navegación lenta no aparece
// como tal: se ve como una página que tardó, sin decir desde dónde venías.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
