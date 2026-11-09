import type { NextConfig } from 'next'

const apiUrl = process.env.VIGIA_API_URL ?? 'http://localhost:3001'

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]
  },
}

export default nextConfig
