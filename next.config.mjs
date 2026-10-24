/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': [
        './*.txt',
        './history.json',
        './aliases.json'
      ],
    },
  },
};

export default nextConfig;
