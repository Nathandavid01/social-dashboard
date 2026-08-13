import * as Sentry from '@sentry/nextjs'

/**
 * Registro de Sentry en el servidor.
 *
 * Next llama esto una vez por runtime y dice cuál es en `NEXT_RUNTIME`. Cada
 * runtime tiene su propia config porque el de edge no puede cargar lo mismo que
 * el de Node — meterlos en un solo archivo rompe el build de edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Next entrega aquí los errores de petición que no captura nadie más: server
 * components, route handlers y server actions. Sin esto, un fallo en una server
 * action se pierde — y en este proyecto casi toda la lógica vive en server
 * actions, así que sería perder justo lo que importa.
 */
export const onRequestError = Sentry.captureRequestError
