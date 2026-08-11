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

export default nextConfig;
