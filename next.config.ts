import type { NextConfig } from "next";
import { execSync } from "child_process";
import path from "path";

const projectRoot = path.resolve(__dirname);
const projectRootPosix = projectRoot.replace(/\\/g, "/");

function caminhoForaDoProjeto(watchPath: string): boolean {
  const normalizado = path.resolve(watchPath).replace(/\\/g, "/");
  return !normalizado.startsWith(projectRootPosix);
}

function resolveAppBuildId() {
  if (process.env.NODE_ENV === "development") {
    return "dev";
  }
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

function resolveAssetPrefix() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw || process.env.NODE_ENV !== "production") return undefined;
  try {
    const url = new URL(raw);
    if (url.hostname === "denteartlab.com.br") {
      url.hostname = "www.denteartlab.com.br";
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

const assetPrefix = resolveAssetPrefix();

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: projectRoot,
  ...(assetPrefix ? { assetPrefix } : {}),
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
      config.watchOptions = {
        ...config.watchOptions,
        followSymlinks: false,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/System Volume Information/**",
          "**/hiberfil.sys",
          "**/swapfile.sys",
          "**/pagefile.sys",
          (watchPath: string) => {
            const base = path.basename(watchPath);
            if (
              base === "hiberfil.sys" ||
              base === "swapfile.sys" ||
              base === "pagefile.sys"
            ) {
              return true;
            }
            if (watchPath.includes("System Volume Information")) return true;
            return caminhoForaDoProjeto(watchPath);
          },
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
