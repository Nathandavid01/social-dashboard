import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Sin esto, los errores de tu máquina, de staging y de producción caen en el
  // mismo saco y no se pueden filtrar. En Vercel `VERCEL_ENV` es
  // production/preview/development; en local no existe y cae a NODE_ENV.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // 100% en desarrollo para ver lo que uno acaba de romper; 10% en producción
  // para no quemar la cuota. Si algún día hace falta más resolución en prod,
  // este número es la perilla — súbelo mirando la cuota, no a ojo.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Adjunta el valor de las variables locales a cada frame del stack. En un
  // dashboard donde el 90% de los fallos son "este campo venía null", esto es
  // la diferencia entre saber cuál y adivinar.
  includeLocalVariables: true,

  enableLogs: true,
})
