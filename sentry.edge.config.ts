import * as Sentry from '@sentry/nextjs'

/**
 * El runtime de edge corre el middleware, que en esta app es quien decide si
 * pasas o te manda al login. Un fallo ahí deja a la gente fuera sin dejar rastro
 * en ningún log de servidor, así que tiene su propia config.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Sin esto, los errores de tu máquina, de staging y de producción caen en el
  // mismo saco y no se pueden filtrar. En Vercel `VERCEL_ENV` es
  // production/preview/development; en local no existe y cae a NODE_ENV.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  enableLogs: true,
})
