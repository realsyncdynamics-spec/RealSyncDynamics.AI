/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone-Output hält das Docker-Image klein.
  output: 'standalone',
};

export default nextConfig;
