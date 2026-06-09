import type { NextConfig } from "next";
import { execSync } from "child_process";
import path from "path";

const projectRoot = path.resolve(__dirname);

function resolveAppBuildId() {
  if (process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim()) {
    return process.env.NEXT_PUBLIC_APP_BUILD_ID.trim();
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA?.trim()) {
    return process.env.VERCEL_GIT_COMMIT_SHA.trim().slice(0, 12);
  }
  if (process.env.GITHUB_SHA?.trim()) {
    return process.env.GITHUB_SHA.trim().slice(0, 12);
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return String(Date.now());
  }
}

const appBuildId = resolveAppBuildId();

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: projectRoot,
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: appBuildId,
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
  turbopack: {
    root: projectRoot,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Webpack aceita RegExp único OU array só de strings (não mistura).
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/pagefile.sys",
          "**/hiberfil.sys",
          "**/swapfile.sys",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
