/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Add support for PDF.js worker
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    return config;
  },
}

module.exports = nextConfig
