import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";
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
  const doArquivo = (() => {
    try {
      const valor = readFileSync(path.join(projectRoot, ".build-id"), "utf8").trim();
      return valor.length >= 6 ? valor : "";
    } catch {
      return "";
    }
  })();
  if (doArquivo) return doArquivo;
  const deEnv = process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim();
  if (deEnv && deEnv.length >= 6) {
    return deEnv;
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
  // Assets relativos (/_next/static) — evita JS/CSS apontando para beta após deploy em www.
  return undefined;
}

const assetPrefix = resolveAssetPrefix();

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: projectRoot,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1",
  },
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
