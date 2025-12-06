/** @type {import('next').NextConfig} */
const nextConfig = {
    // Ensure we handle trailing slashes correctly
    trailingSlash: true,
    // Output standalone for better Docker/hosting support if needed
    output: 'standalone',
};

export default nextConfig;

