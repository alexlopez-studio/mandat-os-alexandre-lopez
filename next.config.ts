import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/admin/market',
        destination: '/app/dashboard',
        permanent: false,
      },
      {
        source: '/admin/market/:path*',
        destination: '/app/:path*',
        permanent: false,
      },
      {
        source: '/app/dashboard/radar',
        destination: '/app/radar',
        permanent: false,
      },
      {
        source: '/app/zones',
        destination: '/app/settings?section=communes',
        permanent: false,
      },
      // "Leads entrants" a ete fusionne dans l'annuaire des contacts.
      {
        source: '/app/leads',
        destination: '/app/contacts',
        permanent: false,
      },
      {
        source: '/app/leads/:path*',
        destination: '/app/contacts',
        permanent: false,
      },
      {
        source: '/app/dashboard/:path+',
        destination: '/app/:path*',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/app/dashboard',
        permanent: false,
      },
      {
        source: '/dashboard/radar',
        destination: '/app/radar',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/app/dashboard',
        destination: '/admin/market',
      },
      {
        source: '/app/:path*',
        destination: '/admin/market/:path*',
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'cdn.pixabay.com' },
      { protocol: 'https', hostname: 'cdn.sanity.io' },
    ],
  },
}

export default nextConfig
