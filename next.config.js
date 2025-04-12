/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'pbs.twimg.com',     // Twitter profile images
      'media.licdn.com',   // LinkedIn profile images
      'scontent.cdninstagram.com', // Instagram content
      'graph.instagram.com',       // Instagram API
      'scontent-iad3-1.cdninstagram.com', // Instagram CDN
      'instagram.com'              // Instagram main domain
    ],
  },
}

module.exports = nextConfig