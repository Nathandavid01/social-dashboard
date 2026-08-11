import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El staging se buildea en su propio directorio: si compartiera `.next/` con
  // `next dev`, levantar staging para los E2E rompería el dev que esté corriendo.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'nathan-thrower',
  project: process.env.SENTRY_PROJECT ?? 'nate-media-social-dashboard',

  // Sin este token el build sigue, pero NO sube los source maps: los stack
  // traces de producción llegan minificados y sirven de poco. Vive en Vercel.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Sube también los archivos de cliente que Next no referencia directamente,
  // para que el stack trace resuelva hasta el componente y no hasta el chunk.
  widenClientFileUpload: true,

  // Los bloqueadores de anuncios tumban las peticiones a ingest.sentry.io. Esto
  // las manda por el propio dominio. Va excluida del middleware — si el
  // middleware la protegiera, los eventos morirían en el redirect al login.
  tunnelRoute: '/monitoring',

  silent: !process.env.CI,
});
