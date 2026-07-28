import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-contained build for the Hostinger VPS: `.next/standalone` ships its
  // own minimal server + only the node_modules actually used, so the server
  // does not need dev dependencies at runtime.
  output: 'standalone',
  compress: true,
  // Nginx terminates TLS and forwards the real client IP / protocol.
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
}

export default nextConfig
