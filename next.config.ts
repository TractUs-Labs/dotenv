import type { NextConfig } from "next";

// Subpath deploy (e.g. https://adminctl.example.com/dotenv). Empty = serve at domain root.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  // Bake into the client bundle so `withBasePath` / fetch helpers see the same value.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
