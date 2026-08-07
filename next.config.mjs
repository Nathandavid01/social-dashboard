/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Scene check envía hasta ~10 frames JPEG en base64 por Server Action;
    // el default de 1mb los rechaza en silencio antes de llegar al action.
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
